import  Launch  from "../models/Launch";
export class LaunchController{

    static  async getLaunchesPagination(req:any , res:any){
       try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const prevPage = page > 1 ? page - 1 : null;
        const totalPages = Math.ceil(await Launch.countDocuments() / limit);
        const nextPage = totalPages > page  ? page + 1 : null;
        if(page>totalPages){
            return res.status(404).json({msg: "Page not found"});
        }
        const launches = await Launch.find({}).skip(skip).limit(limit).sort({ flightNumber: 1 });
        res.status(200).json({ launches, prevPage, nextPage, currentPage: page , totalPages,limit });
       } catch (error) {
         res.status(500).json({msg: "Error fetching launches"});
       }
    };

    static async getAllLaunches(req:any , res:any){
        try {
            const launches = await Launch.find({}).sort({ flightNumber: 1 });
            res.status(200).json( launches );
        } catch (error) {
            res.status(500).json({msg: "Error fetching launches"});
        }
    }

    static async createLaunch(req:any , res:any){
        try {
            const {  mission, rocket, launchDate, destination, customers, upcoming, success } = req.body;
            const latest = await Launch.findOne().sort({ flightNumber: -1 }).select("flightNumber");
            const flightNumber = (latest?.flightNumber ?? 100) + 1;
            const launch = await Launch.create({
                flightNumber,
                mission,
                rocket,
                launchDate,
                destination,
                customers,
                upcoming,
                success,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            res.status(201).json(launch);
        } catch (error) {
            res.status(500).json({msg: "Error creating launch"});
        }
    }


    static async deleteLaunch(req:any , res:any){
        try {
            const flightNumber = req.params.flightNumber;
            const launch = await Launch.findOneAndDelete({ flightNumber: flightNumber });
            if (!launch) {
                return res.status(404).json({ msg: "Launch not found" });
            }
            res.status(200).json({ msg: "Launch deleted successfully" });
        } catch (error) {
            res.status(500).json({msg: "Error deleting launch"});
        }}

    
static async updateLaunch(req: any, res: any) {
  try {
    const { flightNumber } = req.params;

    const launch = await Launch.findOneAndUpdate(
      { flightNumber },
      { success: false, upcoming: false, updatedAt: new Date() },
       { returnDocument: 'after' }
    );

    if (!launch) {
      return res.status(404).json({ msg: "Launch not found" });
    }

    res.status(200).json(launch);
  } catch (error) {
    res.status(500).json({ msg: "Error updating launch" });
  }
}

    //     static async getHistoryLaunches(req:any , res:any){
    //          try {
    //      const launches = await Launch.find({launchDate: {$lt: new Date()} , upcoming: false})

    //       res.status(200).json( launches);
    //    } catch (error) {
    //      res.status(500).json({msg: "Error fetching launches"});
    //    }


    //     }
}




