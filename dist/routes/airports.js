"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const initExpress_1 = require("../initExpress");
const db_1 = require("../db");
let express = require('express');
let router = express.Router();
router.get('/', (req, res) => {
    const cityname = req.query.cityname;
    const query = {
        name: 'fetch-airports',
        text: `
            select 
                airport_name->>'${(0, initExpress_1.getLang)()}' as name, 
                airport_code as code, 
                coordinates, 
                timezone 
            from airports_data` + (cityname ? ` where city->>'${(0, initExpress_1.getLang)()}' = $1` : ''),
        values: cityname ? [cityname] : []
    };
    db_1.db.query(query)
        .then(qres => {
        let result = qres.rows;
        res.json(result);
    })
        .catch(err => {
        res.statusCode = 500;
        res.json(err);
    });
});
const regroup = (el, name) => {
    el[name] = {
        name: el.name,
        timezone: el.timezone,
        coordinates: {
            lng: el.coordinates.x,
            lat: el.coordinates.y
        },
        code: el.code
    };
    el.time = el.time[0];
    delete el.name;
    delete el.timezone;
    delete el.coordinates;
    delete el.code;
};
router.get('/:code/inbound', (req, res) => {
    const airportCode = req.params.code;
    const query = {
        name: "get-inbound-flights",
        text: `
            select flight_no,
                   array_agg(distinct extract(isodow from scheduled_arrival)) as days_of_week,
                   array_agg(distinct scheduled_arrival::time) as time,
                   airport_name ->> '${(0, initExpress_1.getLang)()}' as name,
                   airport_code          as code,
                   coordinates,
                   timezone
            from flights inner join airports_data ad on flights.departure_airport = ad.airport_code
            where status = 'Scheduled' and ad.airport_code = $1
            group by flight_no, airport_name ->> '${(0, initExpress_1.getLang)()}', airport_code, timezone
        `,
        values: [airportCode]
    };
    db_1.db.query(query)
        .then(qres => {
        let result = qres.rows;
        result.forEach(el => regroup(el, 'origin'));
        res.json(result);
    })
        .catch(err => {
        res.statusCode = 500;
        res.json(err);
    });
});
router.get('/:code/outbound', (req, res) => {
    const airportCode = req.params.code;
    const query = {
        name: "get-outbound-flights",
        text: `
            select flight_no,
                   array_agg(distinct extract(isodow from scheduled_departure)) as days_of_week,
                   array_agg(distinct scheduled_departure::time) as time,
                   airport_name ->> '${(0, initExpress_1.getLang)()}' as name,
                   airport_code          as code,
                   coordinates,
                   timezone
            from flights inner join airports_data ad on flights.arrival_airport = ad.airport_code
            where status = 'Scheduled' and ad.airport_code = $1
            group by flight_no, airport_name ->> '${(0, initExpress_1.getLang)()}', airport_code, timezone
        `,
        values: [airportCode]
    };
    db_1.db.query(query)
        .then(qres => {
        let result = qres.rows;
        result.forEach(el => regroup(el, 'destination'));
        res.json(result);
    })
        .catch(err => {
        res.statusCode = 500;
        res.json(err);
    });
});
exports.default = router;
