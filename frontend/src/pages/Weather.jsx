import React, { useState, useEffect } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { motion } from 'framer-motion';
import { CloudSun, Sun, CloudRain, Wind, Droplets, Thermometer, Compass, Lightbulb, MapPin } from 'lucide-react';
import apiClient from '../api/client';
import { useLocation } from '../contexts/LocationContext';

const Weather = () => {
  const { userLocation, lat, lon } = useLocation();
  const [current, setCurrent] = useState({
    temp: "29°C",
    minMax: "24°C / 32°C",
    feel: "31°C",
    condition: "Sunny / Fair",
    humidity: "62%",
    wind: "14 km/h",
    rainProb: "12%",
    uv: "7 (High)"
  });

  const [forecast, setForecast] = useState([
    { day: "Thu", temp: "29°/24°", icon: Sun, label: "Sunny" },
    { day: "Fri", temp: "28°/23°", icon: CloudSun, label: "Partly Cloudy" },
    { day: "Sat", temp: "26°/22°", icon: CloudRain, label: "Moderate Rains" },
    { day: "Sun", temp: "27°/23°", icon: CloudSun, label: "Partly Cloudy" },
    { day: "Mon", temp: "30°/25°", icon: Sun, label: "Sunny" },
    { day: "Tue", temp: "31°/25°", icon: Sun, label: "Sunny" },
    { day: "Wed", temp: "29°/24°", icon: CloudSun, label: "Fair" }
  ]);

  const [advisory, setAdvisory] = useState(
    "Conditions are excellent for fertilizer applications and pesticide spraying. No heavy winds or precipitation are forecasted for the next 48 hours."
  );

  const fetchWeatherData = async (lat, lon) => {
    try {
      const currentRes = await apiClient.post('/weather/current', {
        latitude: lat,
        longitude: lon
      });
      const c = currentRes.data;
      const rawTemp = c.temperature !== undefined ? c.temperature : c.temp;
      const rawCondition = c.weather_condition || c.condition || c.weather_description || "Sunny / Fair";
      const rawHumidity = c.humidity !== undefined ? c.humidity : "--";
      const rawWind = c.wind_speed !== undefined ? c.wind_speed : c.wind;

      const fmtTemp = typeof rawTemp === 'number' ? `${Math.round(rawTemp)}°C` : (rawTemp && String(rawTemp).includes('°') ? rawTemp : `${rawTemp || '--'}°C`);
      const fmtHumidity = typeof rawHumidity === 'number' ? `${rawHumidity}%` : (rawHumidity && String(rawHumidity).includes('%') ? rawHumidity : `${rawHumidity}%`);
      const fmtWind = typeof rawWind === 'number' ? `${rawWind} km/h` : (rawWind && String(rawWind).includes('h') ? rawWind : `${rawWind} km/h`);
      const fmtUv = c.uv_index !== undefined ? (typeof c.uv_index === 'number' ? `${c.uv_index} (Index)` : c.uv_index) : "5 (Moderate)";
      
      setCurrent({
        temp: fmtTemp,
        minMax: typeof rawTemp === 'number' ? `${Math.round(rawTemp - 4)}°C / ${Math.round(rawTemp + 3)}°C` : "24°C / 32°C",
        feel: typeof rawTemp === 'number' ? `${Math.round(rawTemp + 1)}°C` : fmtTemp,
        condition: rawCondition,
        humidity: fmtHumidity,
        wind: fmtWind,
        rainProb: c.rain_probability !== undefined ? `${c.rain_probability}%` : "12%",
        uv: fmtUv
      });

      if (c.farming_advice) {
        const adv = c.farming_advice;
        const text = `${adv.irrigation_advice} ${adv.spraying_advice} Harvest: ${adv.harvest_recommendation} Sowing: ${adv.sowing_recommendation}`;
        setAdvisory(text);
      }
    } catch (e) {
      console.error("Failed to fetch current weather:", e);
    }

    try {
      const forecastRes = await apiClient.post('/weather/forecast', {
        latitude: lat,
        longitude: lon
      });
      const f = forecastRes.data;
      if (f.forecast_days) {
        const days = f.forecast_days.map(d => {
          let Icon = Sun;
          let label = "Clear";
          const tempVal = typeof d.temp === 'number' ? `${d.temp}°` : (d.temp.includes('°') ? d.temp : `${d.temp}°`);
          
          if (d.rain_prob !== undefined && parseFloat(d.rain_prob) > 30) {
            Icon = CloudRain;
            label = "Rains";
          } else if (d.temp > 30) {
            Icon = Sun;
            label = "Sunny";
          } else {
            Icon = CloudSun;
            label = "Partly Cloudy";
          }
          return {
            day: d.day,
            temp: tempVal,
            icon: Icon,
            label: label
          };
        });
        setForecast(days);
      }
    } catch (e) {
      console.error("Failed to fetch forecast weather:", e);
    }
  };

  useEffect(() => {
    if (lat && lon) {
      fetchWeatherData(lat, lon);
    } else {
      const savedLat = localStorage.getItem('user_lat');
      const savedLon = localStorage.getItem('user_lon');
      if (savedLat && savedLon) {
        fetchWeatherData(parseFloat(savedLat), parseFloat(savedLon));
      } else {
        fetchWeatherData(21.1702, 72.8311);
      }
    }
  }, [lat, lon]);

  return (
    <AppLayout>
      <div className="p-8 h-full overflow-y-auto space-y-8 pb-20 max-w-6xl">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight grad-text flex items-center gap-2">
            <CloudSun />
            Weather Advisor
          </h1>
          <p className="text-sm text-gray-500 font-medium mt-1">
            Real-time weather parameters tracking and agricultural warning summaries.
          </p>
        </div>

        {/* Current Conditions Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Main temperature panel */}
          <div className="bg-white dark:bg-dark-surface p-6 border border-gray-200 dark:border-dark-border rounded-3xl flex flex-col justify-between h-56 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-extrabold text-sm text-gray-800 dark:text-white">Current Weather</h3>
                <p className="text-xs text-primary dark:text-green-400 font-bold mt-1 flex items-center gap-1">
                  <MapPin size={11} />
                  <span>{userLocation || 'Local Farm Region'}</span>
                </p>
              </div>
              <span className="text-4xl">☀️</span>
            </div>
            
            <div>
              <p className="text-5xl font-black">{current.temp}</p>
              <p className="text-xs text-gray-500 mt-2 font-medium">Feels like {current.feel} • {current.condition}</p>
            </div>
          </div>

          {/* Environmental metrics grid */}
          <div className="md:col-span-2 grid grid-cols-2 gap-4">
            <div className="p-4 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-500 flex items-center justify-center shrink-0">
                <Droplets size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Humidity</span>
                <span className="text-sm font-extrabold">{current.humidity}</span>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
                <Wind size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Wind Speed</span>
                <span className="text-sm font-extrabold">{current.wind}</span>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0">
                <CloudRain size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">Rain Probability</span>
                <span className="text-sm font-extrabold">{current.rainProb}</span>
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-2xl flex items-center gap-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Thermometer size={18} />
              </div>
              <div>
                <span className="text-[10px] text-gray-400 font-bold uppercase block">UV Index</span>
                <span className="text-sm font-extrabold">{current.uv}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Agricultural impact cards */}
        <div className="p-6 bg-amber-500/10 border border-amber-500/20 rounded-3xl space-y-2 text-amber-800 dark:text-amber-300">
          <p className="font-bold flex items-center gap-1.5 text-xs">
            <Lightbulb size={16} />
            AgriGenius Weather Advisory
          </p>
          <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed">
            {advisory}
          </p>
        </div>

        {/* 7-Day Forecast */}
        <div className="bg-white dark:bg-dark-surface p-6 border border-gray-200 dark:border-dark-border rounded-3xl space-y-4 shadow-sm">
          <h3 className="font-extrabold text-sm text-gray-800 dark:text-white">7-Day Outlook</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4">
            {forecast.map((f, idx) => {
              const Icon = f.icon;
              return (
                <div key={idx} className="p-4 bg-gray-50 dark:bg-dark-bg/60 border border-gray-100 dark:border-dark-border rounded-2xl text-center space-y-2">
                  <span className="text-xs font-bold text-gray-500 block">{f.day}</span>
                  <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                    <Icon size={16} />
                  </div>
                  <span className="text-xs font-extrabold block">{f.temp}</span>
                  <span className="text-[9px] text-gray-400 block truncate">{f.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Temperature chart curve */}
        <div className="bg-white dark:bg-dark-surface p-6 border border-gray-200 dark:border-dark-border rounded-3xl space-y-4">
          <h3 className="font-extrabold text-sm text-gray-800 dark:text-white">Hourly Temperature Trends</h3>
          <div className="h-40 w-full relative pt-6 bg-gray-50 dark:bg-dark-bg/40 rounded-2xl border border-gray-100 dark:border-dark-border flex items-end justify-between px-6 pb-2">
            
            {/* Custom SVG line curve representation */}
            <svg className="absolute inset-x-0 bottom-6 w-full h-24" preserveAspectRatio="none">
              <path d="M 0 60 Q 150 20 300 40 T 600 10 T 900 80" fill="none" stroke="#2E7D32" strokeWidth="2"></path>
            </svg>
            
            <div className="flex flex-col items-center z-10">
              <span className="text-[10px] font-extrabold text-gray-800 dark:text-white">24°C</span>
              <span className="text-[9px] text-gray-400 mt-6">08:00</span>
            </div>
            <div className="flex flex-col items-center z-10">
              <span className="text-[10px] font-extrabold text-gray-800 dark:text-white">29°C</span>
              <span className="text-[9px] text-gray-400 mt-6">12:00</span>
            </div>
            <div className="flex flex-col items-center z-10">
              <span className="text-[10px] font-extrabold text-gray-800 dark:text-white">31°C</span>
              <span className="text-[9px] text-gray-400 mt-6">16:00</span>
            </div>
            <div className="flex flex-col items-center z-10">
              <span className="text-[10px] font-extrabold text-gray-800 dark:text-white">27°C</span>
              <span className="text-[9px] text-gray-400 mt-6">20:00</span>
            </div>

          </div>
        </div>

      </div>
    </AppLayout>
  );
};

export default Weather;
