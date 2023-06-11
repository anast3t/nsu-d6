import {Request, Response} from "express";
import {getLang} from "../initExpress";
import {pool} from "../db";

let express = require('express')
let router = express.Router();

router.get('/', (req: Request, res: Response)=>{
    const cityname = req.query.cityname as string | undefined;
    const query = {
        name: 'fetch-airports',
        text: `
            select 
                airport_name->>'${getLang()}' as name, 
                airport_code as code, 
                coordinates, 
                timezone 
            from airports_data` + (cityname ? ` where city->>'${getLang()}' = $1` : ''),
        values: cityname ? [cityname]:[]
    }
    pool.query(query)
        .then(qres => {
            let result = qres.rows
            result.forEach((el) => {
                el.coordinates.lng = el.coordinates.x
                el.coordinates.lat = el.coordinates.y
                delete el.coordinates.x
                delete el.coordinates.y
            })
            res.json(result)
        })
        .catch(err=>{
            res.statusCode = 500
            console.log(err)
            res.json(err)
        })
})

const regroup = (el:any, name:string) => {
    el[name] = {
        name: el.name,
        timezone: el.timezone,
        coordinates: {
            lng: el.coordinates.x,
            lat: el.coordinates.y
        },
        code: el.code
    }
    el.time = el.time[0]
    delete el.name
    delete el.timezone
    delete el.coordinates
    delete el.code
}

router.get('/:code/inbound', (req: Request, res: Response)=>{
    const airportCode = req.params.code

    const query = {
        name: "get-inbound-flights",
        text: `
            select  flight_no,
                    array_agg(distinct extract(dow from scheduled_arrival)) as days_of_week,
                    array_agg(distinct scheduled_arrival::time)             as time,
                    airport_name ->> '${getLang()}'                         as name,
                    airport_code                                            as code,
                    coordinates,
                    timezone
             from flights as f
                      inner join airports_data ad on f.departure_airport = ad.airport_code
             where status = 'Scheduled'
               and f.arrival_airport = $1
             group by flight_no, airport_name ->> '${getLang()}', airport_code, timezone
        `,
        values: [airportCode]
    }

    pool.query(query)
        .then(qres => {
            let result = qres.rows
            result.forEach(el => regroup(el, 'origin'))
            res.json(result)
        })
        .catch(err=>{
            res.statusCode = 500
            res.json(err)
        })
})

router.get('/:code/outbound', (req: Request, res: Response)=>{
    const airportCode = req.params.code

    const query = {
        name: "get-outbound-flights",
        text: `
            select  flight_no,
                    array_agg(distinct extract(dow from scheduled_arrival)) as days_of_week,
                    array_agg(distinct scheduled_arrival::time)             as time,
                    airport_name ->> '${getLang()}'                         as name,
                    airport_code                                            as code,
                    coordinates,
                    timezone
             from flights as f
                      inner join airports_data ad on f.arrival_airport = ad.airport_code
             where status = 'Scheduled'
               and f.departure_airport = $1
             group by flight_no, airport_name ->> '${getLang()}', airport_code, timezone
        `,
        values: [airportCode]
    }

    pool.query(query)
        .then(qres => {
            let result = qres.rows
            result.forEach(el => regroup(el, 'destination'))
            res.json(result)
        })
        .catch(err=>{
            res.statusCode = 500
            res.json(err)
        })
})

export default router
