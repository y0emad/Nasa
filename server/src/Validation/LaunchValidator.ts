import { body,param, query } from 'express-validator';
import Planet from '../models/Plantes';

    export const createLaunchValidator = [
    
    body('mission').isString().withMessage('Mission is required'),
    body('rocket').isString().withMessage('Rocket is required'),
    body('launchDate').isString().withMessage('Launch date is required'),   
    body('destination').isString().withMessage('Destination is required').custom((value) => {
        const destination = Planet.findOne({ keplerName: value });
        if (!destination) {
            throw new Error('Invalid destination');
        }
        return true;
    }),

    ]
    export const deleteLaunchValidator = [
    
    param("flightNumber").isInt().withMessage("Flight number must be an integer"),

    ]
    export const updateLaunchValidator = [
    
    param("flightNumber").isInt().withMessage("Flight number must be an integer"),

    ]


export const getLaunchPageValidator = [
    query("page").optional().isInt({ min: 1 }).toInt().withMessage("Page must be a positive integer"),
    query("limit").optional().isInt({ min: 1, max: 100 }).toInt().withMessage("Limit must be between 1 and 100"),]