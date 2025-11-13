const mongoose = require("mongoose");
const review = require("./review.js");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
   title: { type: String, required: true },
   description: { type: String },
   image: {
      url: String,
      filename: String,
   },
   price: { type: Number },
   location: { type: String },
   country: { type: String },
   reviews: [
      {
         type: Schema.Types.ObjectId,
         ref: "Review",
      }
   ],
   owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
   },
   geometry: {
      type: {
         type: String,
         enum: ['Point'],
         default: 'Point'
       },
      coordinates: {
         type: [Number],
         default: [0, 0]
       }
   },
   category: {
      type: String,
      enum: [
         "trending", "rooms", "iconic-cities", "mountain", "castles",
         "pools", "camping", "farms", "arctic", "new-listings",
         "apartments", "villas", "luxury", "beachfront", "garden-homes",
         "penthouses", "family-friendly", "commercial", "plots"
      ],
      default: "new-listings"
   },
   
   // ✨ AUCTION FIELDS
   isAuction: { type: Boolean, default: false },
   auctionDays: { type: Number },
   auctionStartTime: { type: Date, default: null },
   auctionEndTime: { type: Date, default: null },
   
   // ✨ BIDDING FIELDS  
   currentBid: { type: Number, default: 0 },
   totalBids: { type: Number, default: 0 },
   highestBidder: { type: Schema.Types.ObjectId, ref: "User", default: null },
   
   // ✨ BID HISTORY
   bidHistory: [{
      bidder: { type: Schema.Types.ObjectId, ref: "User" },
      amount: { type: Number },
      timestamp: { type: Date, default: Date.now }
   }]
});

listingSchema.post("findOneAndDelete", async (listing) => {
   if (listing) {
      await review.deleteMany({
         _id: { $in: listing.reviews }
      });
   }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;