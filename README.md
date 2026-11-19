# PATROL Flight Simulator

PATROL is a WebGL 2 flight simulator for the browser. Fly over Manhattan, Las Vegas, the Alaska Fjords, Dusk Tide Islands, Alder River Valley, or Copper Coast in a Viper jet, a UFO, or a jetpack. Select **? Random Map** for a surprise destination.

The Manhattan map includes a compressed Times Square district shaped by the diagonal of Broadway and the through lanes of Seventh Avenue. Walk signals, traffic lights, trees, street lamps, and numbered crossings line pedestrian plazas with illuminated storefronts, the TKTS red steps, and the ball atop One Times Square.

In Las Vegas, see the Bellagio’s curved tower, fountains and lakeside promenade, the Venetian’s canal and campanile, Caesars Palace’s stone arcades, Wynn’s illuminated entrance, and the Luxor pyramid. Explore the Sphere and ride along with the roller coaster or Ferris wheel using **Scenic Views**.

[Play PATROL on GitHub Pages](https://bhu103-data.github.io/patrol-flight-sim/)

## Controls

- **Mouse**, **WASD**, or the **arrow keys** steer.
- **Space** changes the flight camera.
- **N** opens the map and landmark labels.
- **T** opens the time, season, and weather controls.
- **H** opens Scenic Views in Manhattan and Las Vegas. Choose **Duffy Square Street View**, **Bellagio Lakeside**, **Venetian Canal Walk**, or **Wynn Waterfall** for a closer look.
- **Esc** closes the active panel or returns to the flight menu.

## Run locally

Serve the repository root with a static HTTP server, such as `python3 -m http.server 8000`. Open `http://localhost:8000` in a browser with WebGL 2 enabled. No build step is required.

The world is built to fit the game’s flight area. The Times Square layout references the Broadway pedestrian plazas and Father Duffy Square. [Times Square Alliance](https://www.timessquarenyc.org/business-community/planning-an-event)
