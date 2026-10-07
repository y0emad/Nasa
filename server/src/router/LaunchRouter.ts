import {Router} from "express"
import { LaunchController } from "../Controllers/LaunchController";
import { deleteLaunchValidator, createLaunchValidator, updateLaunchValidator, getLaunchPageValidator } from "../Validation/LaunchValidator";

import { checkErrors } from "../middleWare/checkErrors";

class LaunchRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.getRouter();
        this.postRouter();
        this.putRouter();
        this.deleteRouter();
    }

    getRouter() {
        this.router.get("/get", LaunchController.getAllLaunches)
        this.router.get("/getLaunchesPage",getLaunchPageValidator,checkErrors, LaunchController.getLaunchesPagination)
        // this.router.get("/getHistoryLaunches", LaunchController.getHistoryLaunches);
        }
    
    postRouter() {
        this.router.post("/create", createLaunchValidator, checkErrors, LaunchController.createLaunch);}
    putRouter() {
        this.router.put("/update/:flightNumber",updateLaunchValidator,checkErrors,LaunchController.updateLaunch );}
    deleteRouter() {
        this.router.delete("/delete/:flightNumber", deleteLaunchValidator,checkErrors, LaunchController.deleteLaunch);}
    




    }



export default new LaunchRouter().router;