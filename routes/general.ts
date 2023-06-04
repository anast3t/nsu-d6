import {Request, Response} from "express";
import {db} from "../db";
import {getLang} from "../initExpress";
let express = require('express')
let router = express.Router();


router.get('/', (req: Request, res: Response) => {
    res.send("GOT LANG = " + getLang());
});

router.get('/cities', (req: Request, res: Response)=>{
    const text = `select city->>'${getLang()}' as name, coordinates, timezone from airports_data` as string

    db.query(text).then((qres)=>{
        let result = qres.rows
        res.json(result)
    })
})

router.post('/flights/checkin', (req: Request, res: Response)=>{

})

export default router

