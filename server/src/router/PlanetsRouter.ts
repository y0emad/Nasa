import {Router} from "express"
import { planetsController } from "../Controllers/planetsController"
class PlanetsRouter {
    public router: Router;

    constructor() {
        this.router = Router();
        this.getRouter();
        // this.postRouter();
        // this.putRouter();
        // this.deleteRouter();
    }

    getRouter() {
        this.router.get("/get", planetsController.getAllPlanets);}
    // postRouter() {
    //     this.router.post("/post", );}
    // putRouter() {
    //     this.router.put("/put", );}
    // deleteRouter() {
    //     this.router.delete("/delete", );}
        




    }



export default new PlanetsRouter().router;