import { model, Schema } from "mongoose";

const planetSchema = new Schema(
  {
  

    kepler_name: {
      type: String,
      require: true,
    },
   
  },
  {
    timestamps: true, 
  }
);


const Planet = model('Planet', planetSchema);

export default Planet;