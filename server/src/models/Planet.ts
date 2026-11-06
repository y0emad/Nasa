import { model, Schema } from 'mongoose';

const planetSchema = new Schema(
  {
    kepler_name: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

const Planet = model('Planet', planetSchema);

export default Planet;
