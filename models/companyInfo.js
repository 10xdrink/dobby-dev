import mongoose from "mongoose";

const companyInfoSchema = new mongoose.Schema({
  companyName: { type: String, required: true },        
  phone: { type: String, required: true },       
  email: { type: String, required: true },       
  Country: { type: String},  
  timezone: { type: String },     
  language: { type: String },       
  address: { type: String },      
  lat: { type: String },          
  long: { type: String },        
                  
}, { timestamps: true });

const companyInfo = mongoose.model("companyInfo", companyInfoSchema);
export default companyInfo;
