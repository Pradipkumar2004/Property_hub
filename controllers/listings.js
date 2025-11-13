const Listing = require("../models/listing");
const review = require("../models/review");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const mbxGeocoding = require("@mapbox/mapbox-sdk/services/geocoding");
const mapToken = process.env.MAP_TOKEN;
const geocodingClient = mbxGeocoding({ accessToken: mapToken });

/* ------------------------ INDEX ------------------------ */
module.exports.index = async (req, res) => {
  const allListing = await Listing.find({});
  res.render("./listings/index.ejs", { allListing });
};

/* -------------------- RENDER NEW FORM ------------------ */
module.exports.renderNewForm = (req, res) => {
  res.render("./listings/new.ejs");
};

/* --------------------- SHOW LISTING -------------------- */
module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id)
    .populate({
      path: "reviews",
      populate: {
        path: "author",
        select: "username",
      },
    })
    .populate("owner");

  if (!listing) {
    req.flash("error", "Cannot find that listing!");
    return res.redirect("/listings");
  }
  res.render("./listings/show.ejs", { listing });
};

/* -------------------- CREATE LISTING ------------------- */
module.exports.createListing = async (req, res) => {
  let response = await geocodingClient
    .forwardGeocode({
      query: req.body.listing.location,
      limit: 1,
    })
    .send();

  let url = req.file.path;
  let filename = req.file.filename;

  const newListing = new Listing(req.body.listing);
  newListing.owner = req.user._id;
  newListing.image = { url, filename };
  newListing.geometry = response.body.features[0].geometry;

  // ✨ IMPROVED AUCTION HANDLING
  if (req.body.listing.isAuction === "true") {
    newListing.isAuction = true;
    newListing.auctionStartTime = new Date(req.body.listing.auctionStartTime);
    newListing.auctionEndTime = new Date(req.body.listing.auctionEndTime);
    newListing.currentBid = newListing.price; // Starting bid = listing price
    newListing.totalBids = 0;
    newListing.bidHistory = [];
  }

  let saveListing = await newListing.save();
  console.log("Created Listing:", saveListing);

  req.flash("success", "New Listing Created!");
  
  // ✨ REDIRECT TO AUCTION PAGE IF IT'S AN AUCTION
  if (newListing.isAuction) {
    res.redirect("/listings/auction/live");
  } else {
    res.redirect("/listings");
  }
};


/* -------------------- EDIT FORM ------------------------ */
module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Cannot find that listing!");
    return res.redirect("/listings");
  }

  let OriginalImageUrl = listing.image.url;
  OriginalImageUrl = listing.image.url
    .replace(/w=\d+/, "w=250")
    .replace(/h=\d+/, "h=100");
  console.log("Transformed URL:", OriginalImageUrl);
  res.render("./listings/edit.ejs", { listing, OriginalImageUrl });
};

/* -------------------- UPDATE LISTING ------------------- */
module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  let listing = await Listing.findByIdAndUpdate(id, { ...req.body.listing });

  if (typeof req.file !== "undefined") {
    let url = req.file.path;
    let filename = req.file.filename;
    listing.image = { url, filename };
    await listing.save();
  }

  // 🟢 Auction fields update
  listing.isAuction = req.body.listing.isAuction === "true";
  listing.auctionStartTime = req.body.listing.startTime || null;
  listing.auctionEndTime = req.body.listing.endTime || null;
  await listing.save();

  req.flash("success", "Listing updated!");
  res.redirect(`/listings/${id}`);
};

/* -------------------- DELETE LISTING ------------------- */
module.exports.deleteListing = async (req, res) => {
  let { id } = req.params;
  await Listing.findByIdAndDelete(id);
  req.flash("success", "Listing Deleted!");
  res.redirect("/listings");
};

/* ------------------- FILTER LISTINGS ------------------- */
module.exports.filterListings = async (req, res) => {
  const { category } = req.params;
  try {
    let filteredListings;
    if (category === "trending") {
      filteredListings = await Listing.find({})
        .sort({ reviews: -1 })
        .limit(10);
    } else {
      filteredListings = await Listing.find({ category });
    }
    res.render("listings/index", { allListing: filteredListings });
  } catch (error) {
    req.flash("error", "Error filtering listings");
    res.redirect("/listings");
  }
};

/* ----------------- GET LIVE AUCTIONS ------------------- */
module.exports.getLiveAuctions = async (req, res) => {
  const currentTime = new Date();
  const liveAuctions = await Listing.find({
    isAuction: true,
    auctionStartTime: { $lte: currentTime },
    auctionEndTime: { $gt: currentTime },
  });
  res.render("liveAuction", {
    auctions: liveAuctions,
    currentUser: req.user,
  });
};

/* ------------------ PLACE A BID ------------------------ */
module.exports.placeBid = async (req, res) => {
  try {
    const { id } = req.params;
    const { bidAmount } = req.body;

     console.log("🔥 Bid received:", { id, bidAmount }); 

    const listing = await Listing.findById(id);
    console.log("🏠 Current listing:", { 
      currentBid: listing.currentBid, 
      price: listing.price,
      totalBids: listing.totalBids 
    });

    if (!listing || !listing.isAuction) {
      return res.status(404).json({ error: "Auction not found" });
    }

    // Check if auction is still active
    if (new Date() > listing.auctionEndTime) {
      return res.status(400).json({ error: "Auction has ended" });
    }

    // Validate bid amount
    const currentBid = listing.currentBid || listing.price;
    console.log("💰 Comparing bids:", { bidAmount, currentBid }); 
    if (bidAmount <= currentBid) {
      return res.status(400).json({ error: "Bid must be higher than current bid" });
    }

    // Update listing with new bid
    listing.currentBid = bidAmount;
    listing.totalBids = (listing.totalBids || 0) + 1;
    listing.highestBidder = req.user._id;
    
    // Add to bid history
    listing.bidHistory.push({
      bidder: req.user._id,
      amount: bidAmount,
      timestamp: new Date()
    });

    await listing.save();
    console.log("✅ Saved listing:", { 
      newCurrentBid: savedListing.currentBid, 
      newTotalBids: savedListing.totalBids 
    });

    res.json({ 
      success: true, 
      currentBid: bidAmount,
      totalBids: listing.totalBids 
    });

  } catch (error) {
    console.error("Error placing bid:", error);
    res.status(500).json({ error: "Could not place bid" });
  }
};

module.exports.renderLiveAuctions = async (req, res) => {
  try {
    const currentTime = new Date();
    
    // Get all auction listings
    const auctionListings = await Listing.find({
      isAuction: true
    }).populate('owner').populate('highestBidder', 'username');
    
    // Categorize by status
    const auctions = auctionListings.map(listing => {
      const timeLeft = listing.auctionEndTime - currentTime;
      let status = 'ended';
      
      if (timeLeft > 0) {
        if (timeLeft <= 3600000) { // 1 hour
          status = 'ending-soon';
        } else {
          status = 'live';
        }
      }
      
      return {
        ...listing.toObject(),
        status: status,
        timeLeft: timeLeft
      };
    });
    
    res.render("auction/live.ejs", { 
      auctions: auctions,
      currentUser: req.user 
    });
    
  } catch (error) {
    console.error("Error fetching auctions:", error);
    req.flash("error", "Could not load auctions");
    res.redirect("/listings");
  }
};

module.exports.getAuctionData = async (req, res) => {
  try {
    const currentTime = new Date();
    
    const auctions = await Listing.find({
      isAuction: true
    }).select('title description location category image price currentBid auctionStartTime auctionEndTime totalBids');
    
    const auctionData = auctions.map(auction => {
      const timeLeft = auction.auctionEndTime - currentTime;
      let status = 'ended';
      
      if (timeLeft > 0) {
        status = timeLeft <= 3600000 ? 'ending-soon' : 'live';
      }
      
      return {
        id: auction._id,
        title: auction.title,
        description: auction.description,
        location: auction.location,
        category: auction.category,
        image: auction.image?.url || '/images/default-property.jpg',
        currentBid: auction.currentBid || auction.price,
        startingBid: auction.price,
        endTime: auction.auctionEndTime,
        totalBids: auction.totalBids || 0,
        status: status
      };
    });
    
    res.json(auctionData);
  } catch (error) {
    res.status(500).json({ error: "Could not fetch auction data" });
  }
};