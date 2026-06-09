const express = require("express");
const router = express.Router();
const listings = require("../controllers/listings");
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn, isOwner, validateListing } = require("../middleware.js");
const multer = require("multer");
const { storage } = require("../cloudConfig.js");
const upload = multer({ storage });
const listingController = require("../controllers/listings.js");
const Listing = require("../models/listing");

// 🟢 Render the "Create New Listing" form
router.get("/new", isLoggedIn, listings.renderNewForm);

// 🟢 Filter Listings by Category - PLACED BEFORE "/:id"
router.get("/filter/:category", wrapAsync(listingController.filterListings));

// 🟢 Live Auctions Page (Ensuring 'auction' is treated as a category, not an ID)
router.get("/auction", async (req, res) => {
    res.redirect("/auction/live"); // Redirect to the new live auction page
});

// 🟢 Main Listing Routes
router.route("/")
    .get(listings.index)
    .post(isLoggedIn, upload.single("listing[image]"), wrapAsync(listingController.createListing));


    // Live Auctions Page
router.get("/auction/live", wrapAsync(listings.renderLiveAuctions));

// API endpoint for auction data
router.get("/api/auctions", wrapAsync(listings.getAuctionData));

// Place bid route
router.post("/auction/:id/bid", isLoggedIn, wrapAsync(listings.placeBid));

// 🟢 Show, Edit, Update, and Delete Individual Listing (Must be LAST to avoid conflicts)
router.route("/:id")
    .get(wrapAsync(listings.showListing))  
    .put(isLoggedIn, isOwner, upload.single("listing[image]"), wrapAsync(listings.updateListing))  
    .delete(isLoggedIn, isOwner, wrapAsync(listings.deleteListing));  

// 🟢 Edit Listing Form
router.get("/:id/edit", isLoggedIn, isOwner, wrapAsync(listings.renderEditForm));

module.exports = router;