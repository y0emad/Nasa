import Planet from "../models/Plantes";

export class planetsController{

    static  async getAllPlanets(req:any , res:any){
       try {
         const planets = await Planet.find()
          res.status(200).json( planets);
       } catch (error) {
         res.status(500).json({msg: "Error fetching planets"});
       }
    };



}




