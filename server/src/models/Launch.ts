import { model, Schema } from "mongoose";

const LaunchSchema = new Schema({
 flightNumber : {
    type: Number,
    required: true,
    unique: true,
 },
 mission : {
    type: String,
    required: true,},
rocket:{
    type: String,
    required: true,
},
launchDate : {
    type: Date,
    required: true,},
destination:{
    type: String,
    
    required: true,
},
customers : {
    type: Array,
    default: ["NASA", "SpaceX"],
    required: true,
},
upcoming : {
    type: Boolean,
    default: true,
    required: true,},
success : {
    type: Boolean,
    default: true,
    required: true,}
   


} ,
   {
     timestamps: true
    })




const Launch = model('Launch', LaunchSchema);

export default Launch;