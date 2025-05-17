import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

// Import Mapbox as an ESM module
import mapboxgl from 'https://cdn.jsdelivr.net/npm/mapbox-gl@2.15.0/+esm';

// Check that Mapbox GL JS is loaded
console.log('Mapbox GL JS Loaded:', mapboxgl);

// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoibWx5YW5nIiwiYSI6ImNtYXJ1ZHJndDBmajUyam9oa3cyYnZoejEifQ.rGThozwnQP6tk9aDHOtp3g';




let departuresByMinute = Array.from({ length: 1440 }, () => []);
let arrivalsByMinute = Array.from({ length: 1440 }, () => []);



// Initialize the map
const map = new mapboxgl.Map({
  container: 'map', // ID of the div where the map will render
  style: 'mapbox://styles/mapbox/streets-v12', // Map style
  center: [-71.09415, 42.36027], // [longitude, latitude]
  zoom: 12, // Initial zoom level
  minZoom: 5, // Minimum allowed zoom
  maxZoom: 18, // Maximum allowed zoom
});


// We’ll create a helper function, getCoords(), that takes in a station object and 
// converts its longitude (lon) and latitude (lat) into pixel coordinates using map.project(). 
// Create this function outside of the map.on('load',...) aka globally so that it can be accessed anywhere in the script, 
// including during map interactions like zooming, panning, and updating station positions dynamically.
function getCoords(station) {
  const point = new mapboxgl.LngLat(+station.lon, +station.lat); // Convert lon/lat to Mapbox LngLat
  const { x, y } = map.project(point); // Project to pixel coordinates
  return { cx: x, cy: y }; // Return as object for use in SVG attributes
}



// Mapbox provides an addSource function to connect the map with an external data source. 
// However, to use any of that, we first need to wait for the "load" event to fire on map 
// to make sure the map is fully loaded before fetching and displaying the data:
map.on('load', async () => {
    let bikelanePaintStyle = {
        // 'line-color': 'green',
        // 'line-width': 3,
        // 'line-opacity': 0.4,
        'line-color': '#32D400',  // A bright green using hex code
        'line-width': 5,          // Thicker lines
        'line-opacity': 0.6       // Slightly less transparent
    };
    
    
    map.addSource('boston_route', {
    type: 'geojson',
    data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson',
    });

    map.addLayer({
    id: 'bike-lanes-boston',
    type: 'line', // other layer types: 'fill', 'circle', or 'symbol'
    source: 'boston_route',
    paint: bikelanePaintStyle,
    });


    
    map.addSource('cambridge_route', {
    type: 'geojson',
    data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson',
    });

    map.addLayer({
    id: 'bike-lanes-cambridge',
    type: 'line', // other layer types: 'fill', 'circle', or 'symbol'
    source: 'cambridge_route',
    paint: bikelanePaintStyle,
    });

    


        const jsonurl = 'https://dsc106.com/labs/lab07/data/bluebikes-stations.json';

        // Await JSON fetch
        const jsonData = await d3.json(jsonurl);
        console.log('Loaded JSON Data:', jsonData); // Log to verify structure

        //let stations = jsonData.data.stations;
        // const stations = computeStationTraffic(jsonData.data.stations, trips);
        const stations = computeStationTraffic(jsonData.data.stations);
        console.log('Stations Array:', stations);

        const radiusScale = d3
        .scaleSqrt()
        .domain([0, d3.max(stations, (d) => d.totalTraffic)])
        .range([0, 25]);


        
        const svg = d3.select('#map').select('svg');

    // Append circles to the SVG for each station
    const circles = svg
        .selectAll('circle')
        .data(stations, (d) => d.short_name) // Use station short_name as the key
        .data(stations)
        .enter() // The enter() selection binds the data and appends a <circle> for each station.
        .append('circle')
        .attr('r', 5) // Radius of the circle
        .attr('fill', 'steelblue') // Circle fill color
        .attr('stroke', 'white') // Circle border color
        .attr('stroke-width', 1) // Circle border thickness
        .attr('opacity', 0.8) // Circle opacity
        // Iterates over each circle
        .each(function (d) {
            // Add <title> for browser tooltips
            d3.select(this)
            .append('title')
            // Sets the tooltip text to show total trips, departures, and arrivals.
            .text(
                `${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`,
            );
        })
        .style('--departure-ratio', (d) =>
            stationFlow(d.departures / d.totalTraffic),
        );

    // We need to ensure the station markers stay aligned when the map pans, zooms, or resizes. 
    // We'll define an updatePositions() function to reposition the circles whenever the map changes. 
    // Place this code right beneath const circles = ....

    // Function to update circle positions when the map moves/zooms
    function updatePositions() {
    circles
        .attr('cx', (d) => getCoords(d).cx) // Set the x-position using projected coordinates
        .attr('cy', (d) => getCoords(d).cy); // Set the y-position using projected coordinates
    }
    // Initial position update when map loads
    updatePositions();

    // We'll listen to Mapbox events like move, zoom, and moveend to call the updatePositions() function whenever the map changes.

    // Reposition markers on map interactions
    map.on('move', updatePositions); // Update during map movement
    map.on('zoom', updatePositions); // Update during zooming
    map.on('resize', updatePositions); // Update on window resize
    map.on('moveend', updatePositions); // Final adjustment after movement ends

// We will select the slider and display elements inside map.on('load', ...), 
    // after the map event listeners we implemented previously:
    const timeSlider = document.getElementById('#time-slider');
    const selectedTime = document.getElementById('#selected-time');
    const anyTimeLabel = document.getElementById('#any-time');

        const trafficcsvurl = 'https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv';
        // Await traffic data
        let trips = await d3.csv(trafficcsvurl,
            (trip) => {
                trip.started_at = new Date(trip.started_at);
                trip.ended_at = new Date(trip.ended_at);

                let startedMinutes = minutesSinceMidnight(trip.started_at);
                //This function returns how many minutes have passed since `00:00` (midnight).
                departuresByMinute[startedMinutes].push(trip);
                //This adds the trip to the correct index in `departuresByMinute` 
                // so that later we can efficiently retrieve all trips that started at a specific time.

                // TODO: Same for arrivals
                let endedMinutes = minutesSinceMidnight(trip.ended_at);
                //This function returns how many minutes have passed since `00:00` (midnight).
                arrivalsByMinute[endedMinutes].push(trip);
                //This adds the trip to the correct index in `departuresByMinute` 
                // so that later we can efficiently retrieve all trips that started at a specific time.
            
                return trip;
            },
        );


        console.log('Loaded traffic csv Data:', trips); // Log to verify structure
    

    
    // bind the slider’s input event to our function so that it updates the time in real-time.
    timeSlider.addEventListener('input', updateTimeDisplay);
    updateTimeDisplay();


    // Place this Inside map.on('load', ...), after updateTimeDisplay() has been defined. This function will:
    // Filter the trip data based on the selected time.
    // Recompute station traffic using the filtered trips.
    // Update the circle sizes to reflect the new traffic values.
    function updateScatterPlot(timeFilter) {
        // // Get only the trips that match the selected time filter
        // const filteredTrips = filterTripsbyTime(trips, timeFilter);
        // // Recompute station traffic based on the filtered trips
        // const filteredStations = computeStationTraffic(stations, filteredTrips);
        const filteredStations = computeStationTraffic(stations, timeFilter);

        // If no filtering is applied (timeFilter === -1), the circle sizes use the default range [0, 25]. 
        // If filtering is applied, the minimum and maximum sizes increase to [3, 50], making circles more prominent. 
        // This ensures that even with fewer data points, stations remain visible and properly scaled.
        timeFilter === -1 ? radiusScale.range([0, 25]) : radiusScale.range([3, 50]);

        // Update the scatterplot by adjusting the radius of circles
        circles
            .data(filteredStations, (d) => d.short_name) // Ensure D3 tracks elements correctly
            .join('circle') // Ensure the data is bound correctly
            .attr('r', (d) => radiusScale(d.totalTraffic)) // Update circle sizes
            .style('--departure-ratio', (d) =>
                stationFlow(d.departures / d.totalTraffic),
                );
        }




});

function formatTime(minutes) {
  const date = new Date(0, 0, 0, 0, minutes); // Set hours & minutes
  return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

function updateTimeDisplay() {
  let timeFilter = Number(timeSlider.value); // Get slider value

  if (timeFilter === -1) {
    selectedTime.textContent = ''; // Clear time display
    anyTimeLabel.style.display = 'block'; // Show "(any time)"
  } else {
    selectedTime.textContent = formatTime(timeFilter); // Display formatted time
    anyTimeLabel.style.display = 'none'; // Hide "(any time)"
  }

  // Call updateScatterPlot to reflect the changes on the map
  updateScatterPlot(timeFilter);
}

// function computeStationTraffic(stations, trips) {
// // What Does the Function Do?

// // Take stations and trips as arguments (so it works with any dataset).
// // Compute arrivals and departures** using d3.rollup().
// // Update each station with the calculated values (arrivals, departures, and total traffic).
// // Return the updated station data** so it can be used elsewhere.


//   // Compute departures
//   const departures = d3.rollup(
//     trips,
//     (v) => v.length,
//     (d) => d.start_station_id,
//   );

//   // Computed arrivals as you did in step 4.2

//   // Update each station..
//   return stations.map((station) => {
//     let id = station.short_name;
//     station.arrivals = arrivals.get(id) ?? 0;
//     // what you updated in step 4.2
//     return station;
//   });
// }
function computeStationTraffic(stations, timeFilter = -1) {
  // Retrieve filtered trips efficiently
  const departures = d3.rollup(
    filterByMinute(departuresByMinute, timeFilter), // Efficient retrieval
    (v) => v.length,
    (d) => d.start_station_id
  );

  const arrivals = d3.rollup(
    filterByMinute(arrivalsByMinute, timeFilter), // Efficient retrieval
    (v) => v.length,
    (d) => d.end_station_id
  );

  // Update station data with filtered counts
  return stations.map((station) => {
    let id = station.short_name;
        station.arrivals = arrivals.get(id)?? 0;
        station.departures = departures.get(id)?? 0;
        station.totalTraffic = station.arrivals + station.departures;
        return station;
    });
}

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
}

// function filterTripsbyTime(trips, timeFilter) {
//   return timeFilter === -1
//     ? trips // If no filter is applied (-1), return all trips
//     : trips.filter((trip) => {
//         // Convert trip start and end times to minutes since midnight
//         const startedMinutes = minutesSinceMidnight(trip.started_at);
//         const endedMinutes = minutesSinceMidnight(trip.ended_at);

//         // Include trips that started or ended within 60 minutes of the selected time
//         return (
//           Math.abs(startedMinutes - timeFilter) <= 60 ||
//           Math.abs(endedMinutes - timeFilter) <= 60
//         );
//       });
// }
function filterByMinute(tripsByMinute, minute) {
  if (minute === -1) {
    return tripsByMinute.flat(); // No filtering, return all trips
  }

  // Normalize both min and max minutes to the valid range [0, 1439]
  let minMinute = (minute - 60 + 1440) % 1440;
  let maxMinute = (minute + 60) % 1440;

  // Handle time filtering across midnight
  if (minMinute > maxMinute) {
    let beforeMidnight = tripsByMinute.slice(minMinute);
    let afterMidnight = tripsByMinute.slice(0, maxMinute);
    return beforeMidnight.concat(afterMidnight).flat();
  } else {
    return tripsByMinute.slice(minMinute, maxMinute).flat();
  }
}

let stationFlow = d3.scaleQuantize().domain([0, 1]).range([0, 0.5, 1]);


