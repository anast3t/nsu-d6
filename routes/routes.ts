import {Request, Response} from "express";

let express = require('express')
let router = express.Router();

router.get('/', (req: Request, res: Response)=>{
    const pointA = req.query.point_a as string;
    const pointB = req.query.point_b as string;
    const departureDate = req.query.departure_date as string;
    const bookingClass = req.query.booking_class as string;
    const connections = req.query.connections as string;



})

router.post('/booking', (req: Request, res: Response)=>{

})

export default router
