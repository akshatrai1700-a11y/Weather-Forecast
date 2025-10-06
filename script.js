// Free weather API - no API key required
const WEATHER_API_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_API_URL = 'https://geocoding-api.open-meteo.com/v1/search';

// Initialize variables
let map;
let currentLat = 51.5074; // Default: London
let currentLon = -0.1278;
let heatLayer;
let windLayer;

// Initialize the application
async function initApp() {
    await initMap();
    await searchWeather(); // Load default weather for London
}

// Initialize the map
async function initMap() {
    map = L.map('map').setView([currentLat, currentLon], 10);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Add default temperature layer
    showTemperatureMap();
}

// Search weather by city name
async function searchWeather() {
    const cityInput = document.getElementById('cityInput').value.trim();
    if (!cityInput) {
        showError('Please enter a city name');
        return;
    }

    showLoading();
    
    try {
        // Get coordinates for the city
        const geoResponse = await fetch(`${GEOCODING_API_URL}?name=${encodeURIComponent(cityInput)}&count=1`);
        const geoData = await geoResponse.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            showError('City not found. Please try another city.');
            return;
        }
        
        const { latitude, longitude, name, country } = geoData.results[0];
        currentLat = latitude;
        currentLon = longitude;
        
        // Get weather data
        await getWeatherData(latitude, longitude, name, country);
        
        // Update map view
        map.setView([latitude, longitude], 10);
        updateMapLayers();
        
    } catch (error) {
        console.error('Error fetching weather data:', error);
        showError('Error fetching weather data. Please try again.');
    }
}

// Get current location
function getCurrentLocation() {
    if (navigator.geolocation) {
        showLoading();
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                currentLat = position.coords.latitude;
                currentLon = position.coords.longitude;
                
                try {
                    // Get city name from coordinates
                    const response = await fetch(
                        `${GEOCODING_API_URL}?latitude=${currentLat}&longitude=${currentLon}&count=1`
                    );
                    const data = await response.json();
                    const cityName = data.results?.[0]?.name || 'Your Location';
                    const country = data.results?.[0]?.country || '';
                    
                    await getWeatherData(currentLat, currentLon, cityName, country);
                    map.setView([currentLat, currentLon], 10);
                    updateMapLayers();
                    
                } catch (error) {
                    console.error('Error getting location name:', error);
                    await getWeatherData(currentLat, currentLon, 'Your Location', '');
                }
            },
            (error) => {
                showError('Error getting location: ' + error.message);
            }
        );
    } else {
        showError('Geolocation is not supported by this browser.');
    }
}

// Get weather data from coordinates
async function getWeatherData(lat, lon, cityName, country) {
    try {
        // Fetch current weather and forecast
        const response = await fetch(
            `${WEATHER_API_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,snowfall,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto&forecast_days=6`
        );
        
        const data = await response.json();
        
        if (!data.current) {
            throw new Error('No weather data available');
        }
        
        displayCurrentWeather(data, cityName, country);
        displayForecast(data);
        
    } catch (error) {
        console.error('Error fetching weather data:', error);
        showError('Error fetching weather data. Please try again.');
    }
}

// Display current weather
function displayCurrentWeather(data, cityName, country) {
    const current = data.current;
    const currentWeatherDiv = document.getElementById('currentWeather');
    
    const temp = Math.round(current.temperature_2m);
    const feelsLike = Math.round(current.apparent_temperature);
    const humidity = current.relative_humidity_2m;
    const windSpeed = current.wind_speed_10m;
    const windDeg = current.wind_direction_10m;
    const weatherCode = current.weather_code;
    
    const weatherInfo = getWeatherInfo(weatherCode);
    
    currentWeatherDiv.innerHTML = `
        <h3>${cityName}, ${country}</h3>
        <div class="temperature">${temp}°C</div>
        <div class="description">
            <img src="${weatherInfo.icon}" alt="${weatherInfo.description}" class="weather-icon">
            ${weatherInfo.description}
        </div>
        <div class="weather-info">
            <div class="info-item">
                <strong>Feels Like</strong>
                ${feelsLike}°C
            </div>
            <div class="info-item">
                <strong>Humidity</strong>
                ${humidity}%
            </div>
            <div class="info-item">
                <strong>Wind Speed</strong>
                ${windSpeed} km/h
            </div>
            <div class="info-item">
                <strong>Wind Direction</strong>
                <span class="wind-direction" style="transform: rotate(${windDeg}deg)">↑</span>
                ${getWindDirection(windDeg)}
            </div>
        </div>
    `;
}

// Display 5-day forecast
function displayForecast(data) {
    const forecastDiv = document.getElementById('forecast');
    const daily = data.daily;
    
    forecastDiv.innerHTML = '';
    
    // Skip today (index 0) and show next 5 days
    for (let i = 1; i <= 5; i++) {
        const date = new Date(daily.time[i]);
        const dayName = date.toLocaleDateString('en', { weekday: 'short' });
        const maxTemp = Math.round(daily.temperature_2m_max[i]);
        const minTemp = Math.round(daily.temperature_2m_min[i]);
        const weatherCode = daily.weather_code[i];
        const windSpeed = daily.wind_speed_10m_max[i];
        const precipitation = daily.precipitation_sum[i];
        
        const weatherInfo = getWeatherInfo(weatherCode);
        
        const forecastCard = document.createElement('div');
        forecastCard.className = 'forecast-card';
        forecastCard.innerHTML = `
            <h4>${dayName}</h4>
            <div>${date.getDate()}/${date.getMonth() + 1}</div>
            <img src="${weatherInfo.icon}" alt="${weatherInfo.description}" class="weather-icon">
            <div class="temp">${maxTemp}° / ${minTemp}°</div>
            <div class="details">
                💨 ${windSpeed} km/h<br>
                💧 ${precipitation}mm
            </div>
        `;
        forecastDiv.appendChild(forecastCard);
    }
}

// Map layer functions
function showTemperatureMap() {
    setActiveButton('🌡️ Temperature');
    updateMapLayers();
}

function showWindMap() {
    setActiveButton('💨 Wind Flow');
    updateMapLayers();
}

function showPrecipitationMap() {
    setActiveButton('💧 Precipitation');
    updateMapLayers();
}

function updateMapLayers() {
    // Clear existing layers
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }
    if (windLayer) {
        map.removeLayer(windLayer);
    }
    
    const activeButton = document.querySelector('.map-controls button.active').textContent;
    
    // Generate sample data around current location for demonstration
    const points = [];
    for (let i = 0; i < 50; i++) {
        const lat = currentLat + (Math.random() - 0.5) * 0.2;
        const lon = currentLon + (Math.random() - 0.5) * 0.2;
        
        if (activeButton.includes('Temperature')) {
            // Temperature data (15-30°C range)
            const intensity = Math.random() * 15 + 15;
            points.push([lat, lon, intensity]);
        } else if (activeButton.includes('Wind')) {
            // Wind data
            const intensity = Math.random() * 10;
            points.push([lat, lon, intensity]);
        } else {
            // Precipitation data
            const intensity = Math.random() * 5;
            points.push([lat, lon, intensity]);
        }
    }
    
    if (activeButton.includes('Temperature')) {
        heatLayer = L.heatLayer(points, {
            radius: 25,
            blur: 15,
            gradient: {
                0.4: 'blue',
                0.6: 'cyan',
                0.7: 'lime',
                0.8: 'yellow',
                1.0: 'red'
            },
            maxZoom: 10
        }).addTo(map);
    } else {
        heatLayer = L.heatLayer(points, {
            radius: 20,
            blur: 10,
            gradient: activeButton.includes('Wind') ? {
                0.4: 'rgba(0, 0, 255, 0.4)',
                0.6: 'rgba(0, 255, 255, 0.6)',
                0.8: 'rgba(255, 255, 0, 0.8)',
                1.0: 'rgba(255, 0, 0, 1)'
            } : {
                0.4: 'rgba(0, 0, 255, 0.4)',
                0.6: 'rgba(0, 255, 0, 0.6)',
                0.8: 'rgba(255, 255, 0, 0.8)',
                1.0: 'rgba(255, 0, 0, 1)'
            },
            maxZoom: 10
        }).addTo(map);
    }
}

// Helper functions
function setActiveButton(buttonText) {
    document.querySelectorAll('.map-controls button').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent === buttonText) {
            btn.classList.add('active');
        }
    });
}

function getWindDirection(degrees) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
}

function getWeatherInfo(code) {
    const weatherMap = {
        0: { description: 'Clear sky', icon: '☀️' },
        1: { description: 'Mainly clear', icon: '🌤️' },
        2: { description: 'Partly cloudy', icon: '⛅' },
        3: { description: 'Overcast', icon: '☁️' },
        45: { description: 'Fog', icon: '🌫️' },
        48: { description: 'Depositing rime fog', icon: '🌫️' },
        51: { description: 'Light drizzle', icon: '🌦️' },
        53: { description: 'Moderate drizzle', icon: '🌦️' },
        55: { description: 'Dense drizzle', icon: '🌦️' },
        61: { description: 'Slight rain', icon: '🌧️' },
        63: { description: 'Moderate rain', icon: '🌧️' },
        65: { description: 'Heavy rain', icon: '⛈️' },
        80: { description: 'Slight rain showers', icon: '🌦️' },
        81: { description: 'Moderate rain showers', icon: '🌧️' },
        82: { description: 'Violent rain showers', icon: '⛈️' },
        95: { description: 'Thunderstorm', icon: '⛈️' },
        96: { description: 'Thunderstorm with hail', icon: '⛈️' }
    };
    
    return weatherMap[code] || { description: 'Unknown', icon: '❓' };
}

function showLoading() {
    document.getElementById('currentWeather').innerHTML = '<div class="loading">Loading weather data...</div>';
    document.getElementById('forecast').innerHTML = '<div class="loading">Loading forecast...</div>';
}

function showError(message) {
    document.getElementById('currentWeather').innerHTML = `<div class="error">${message}</div>`;
}

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    
    // Add enter key support for search
    document.getElementById('cityInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchWeather();
        }
    });
});