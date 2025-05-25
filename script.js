let map = L.map('map').setView([45.26405, 27.9699], 13);

// Custom blue marker icon
const blueIcon = new L.Icon({
  iconUrl: 'https://chart.googleapis.com/chart?chst=d_map_pin_letter&chld=%E2%80%A2|0077cc',
  iconSize: [21, 34],
  iconAnchor: [10, 34],
  popupAnchor: [1, -34],
});

// Robot moving marker
let robotMarker = L.marker([45.0, 26.0]).addTo(map);

// Fixed base location marker
let fixedMarker = L.marker([45.26405, 27.9699], { icon: blueIcon }).addTo(map);

// Dynamic target marker (null at start)
let targetMarker = null;

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© OpenStreetMap'
}).addTo(map);

// EVENT LOGGER SETUP

const EventType = {
  USER_ACTION: 'User Action',
  ROBOT_HEALTH: 'Robot Health',
  ROBOT_ACTIVITY: 'Robot Activity',
};

let eventLogs = [];
let showCoordinateUpdates = true; // control coord logs
let lastCoordLogTime = 0;
let nextCoordLogDelay = getRandomDelay(); // init random delay 1-5s

// Checkbox toggle listener for coordinate logs
const toggleCoordsCheckbox = document.getElementById('toggleCoords');
if (toggleCoordsCheckbox) {
  toggleCoordsCheckbox.checked = true;
  toggleCoordsCheckbox.addEventListener('change', (e) => {
    showCoordinateUpdates = e.target.checked;
  });
}

function addEvent(type, message) {
  const timestamp = new Date().toLocaleTimeString();
  eventLogs.push({ timestamp, type, message });
  updateEventLogUI();
}

function updateEventLogUI() {
  const logContainer = document.getElementById('event-log');
  if (!logContainer) return;

  logContainer.innerHTML = '';

  eventLogs.forEach(({ timestamp, type, message }) => {
    const logItem = document.createElement('div');
    logItem.classList.add('log-item');

    if (type === EventType.USER_ACTION) logItem.style.color = '#0077cc';
    else if (type === EventType.ROBOT_HEALTH) logItem.style.color = '#cc0000';
    else if (type === EventType.ROBOT_ACTIVITY) logItem.style.color = '#00cc44';

    logItem.innerHTML = `<b>[${timestamp}] [${type}]</b> ${message}`;
    logContainer.appendChild(logItem);
  });

  logContainer.scrollTop = logContainer.scrollHeight;
}

async function updateStatus() {
  try {
    const res = await fetch('http://127.0.0.1:5000/robot/status');
    const data = await res.json();

    // Update robot position on map
    robotMarker.setLatLng([data.position.lat, data.position.lon]);

    // Update battery UI
    document.getElementById('battery-bar').value = data.battery;
    document.getElementById('battery-percent').innerText = `${data.battery}%`;

    // Update last update time UI
    document.getElementById('last-update').innerText = new Date().toLocaleTimeString();

    // Update info box
    document.getElementById('info').innerHTML = `
      <b>Robot status</b><br>
      <b>Coordonate:</b><br>
      Lat: ${data.position.lat.toFixed(5)}<br>
      Lon: ${data.position.lon.toFixed(5)}<br>
    `;

    // Log coordinate update only if delay passed and checkbox checked
    const now = Date.now();
    if (showCoordinateUpdates && (now - lastCoordLogTime >= nextCoordLogDelay)) {
      addEvent(EventType.USER_ACTION, `Status updated: Lat ${data.position.lat.toFixed(5)}, Lon ${data.position.lon.toFixed(5)}`);
      lastCoordLogTime = now;
      nextCoordLogDelay = getRandomDelay(); // new random delay for next log
    }

    // Battery warning event
    if (data.battery < 20) {
      addEvent(EventType.ROBOT_HEALTH, 'Battery low warning!');
    }

  } catch (err) {
    console.error('Eroare la fetch:', err);
    addEvent(EventType.ROBOT_HEALTH, 'Eroare la fetch status');
  }
}

function getRandomDelay() {
  return Math.floor(Math.random() * 4000) + 1000; // 1000 to 5000 ms
}

// Call updateStatus every second for fresh data from robot
setInterval(updateStatus, 1000);

// SET NEW TARGET ON MAP
document.getElementById('sendTarget').addEventListener('click', () => {
  addEvent(EventType.USER_ACTION, 'Waiting for target selection on map...');
  map.once('click', async (e) => {
    const { lat, lng } = e.latlng;

    // Remove old target marker if exists
    if (targetMarker) targetMarker.remove();

    // Add new target marker
    targetMarker = L.marker([lat, lng], {
      icon: new L.Icon.Default()
    }).addTo(map);

    // Update target coords UI
    document.getElementById('target-coords').innerText = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    addEvent(EventType.USER_ACTION, `Target set: Lat ${lat.toFixed(5)}, Lon ${lng.toFixed(5)}`);

    // Send target coords to backend robot API
    await fetch('http://127.0.0.1:5000/robot/target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lon: lng })
    });

    addEvent(EventType.ROBOT_ACTIVITY, 'Robot started calculating route to target');
  });
});

// Manual refresh button listener
document.getElementById('refreshBtn').addEventListener('click', () => {
  updateStatus();
  addEvent(EventType.USER_ACTION, 'Manual refresh triggered');
});
