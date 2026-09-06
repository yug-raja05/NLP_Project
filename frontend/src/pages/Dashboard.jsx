import React, { useState, useEffect, useMemo } from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from '../contexts/LocationContext';
import { Tractor, Sprout, Wind, MapPin, Sparkles, TrendingUp, AlertTriangle, Lightbulb, Calendar, ArrowRight, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

const Dashboard = () => {
  const { profile } = useAuth();
  const { userLocation, lat, lon, locationReady, detecting, refreshLocation, updateLocationManually } = useLocation();
  const navigate = useNavigate();

  const [weather, setWeather] = useState(() => {
    try {
      const cached = sessionStorage.getItem('dashboard_weather');
      if (cached) return JSON.parse(cached);
    } catch (e) {}
    return {
      temp: "--°C",
      condition: "Loading weather...",
      humidity: "--%",
      wind: "-- km/h",
      loading: true
    };
  });

  const [marketPrices, setMarketPrices] = useState([]);
  const [marketLoading, setMarketLoading] = useState(true);

  const [suggestions, setSuggestions] = useState([
    { title: "Analyzing farm conditions...", desc: "Fetching real-time recommendations based on your local coordinates...", priority: "medium" }
  ]);

  const [reminders, setReminders] = useState([
    { title: "Syncing calendar...", date: "Retrieving active tasks..." }
  ]);

  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [locationInput, setLocationInput] = useState("");

  const cropsKey = profile?.primary_crops && profile.primary_crops.length > 0
    ? profile.primary_crops.join(',')
    : "Wheat,Maize,Soybeans";

  const activeCrops = useMemo(() => {
    return cropsKey.split(',');
  }, [cropsKey]);

  const fetchWeather = async (lat, lon) => {
    try {
      const response = await apiClient.post('/weather/current', {
        latitude: lat,
        longitude: lon
      });
      const data = response.data;
      const rawTemp = data.temperature !== undefined ? data.temperature : data.temp;
      const rawCondition = data.weather_condition || data.condition || data.weather_description || "Clear";
      const rawHumidity = data.humidity !== undefined ? data.humidity : "--";
      const rawWind = data.wind_speed !== undefined ? data.wind_speed : data.wind;

      const fmtTemp = typeof rawTemp === 'number' ? `${Math.round(rawTemp)}°C` : (rawTemp && String(rawTemp).includes('°') ? rawTemp : `${rawTemp || '--'}°C`);
      const fmtHumidity = typeof rawHumidity === 'number' ? `${rawHumidity}%` : (rawHumidity && String(rawHumidity).includes('%') ? rawHumidity : `${rawHumidity}%`);
      const fmtWind = typeof rawWind === 'number' ? `${rawWind} km/h` : (rawWind && String(rawWind).includes('h') ? rawWind : `${rawWind} km/h`);

      const weatherPayload = {
        temp: fmtTemp,
        condition: rawCondition,
        humidity: fmtHumidity,
        wind: fmtWind,
        loading: false
      };
      setWeather(weatherPayload);
      try {
        sessionStorage.setItem('dashboard_weather', JSON.stringify(weatherPayload));
      } catch (e) {}

      if (data.farming_advice) {
        const adv = data.farming_advice;
        const newSuggestions = [
          { title: "Irrigation advice", desc: adv.irrigation_advice, priority: "high" },
          { title: "Spraying advice", desc: adv.spraying_advice, priority: "medium" },
          { title: "Harvest planning", desc: adv.harvest_recommendation, priority: "warning" }
        ];
        setSuggestions(newSuggestions);
      }
    } catch (err) {
      console.error("Failed to fetch weather from backend:", err);
      setWeather(prev => ({ ...prev, loading: false }));
    }
  };

  const handleLocationSubmit = async (val) => {
    setIsEditingLocation(false);
    if (!val.trim()) return;
    await updateLocationManually(val);
  };

  // Fetch weather when location is ready or changes
  useEffect(() => {
    if (locationReady && lat && lon) {
      fetchWeather(lat, lon);
    }
  }, [locationReady, lat, lon]);

  useEffect(() => {
    let isMounted = true;
    const fetchMarketPrices = async () => {
      if (!activeCrops || activeCrops.length === 0) {
        if (isMounted) setMarketLoading(false);
        return;
      }
      try {
        if (isMounted) setMarketLoading(true);
        
        // Fast batch request
        try {
          const batchRes = await apiClient.post('/market/batch-prices', {
            crops: activeCrops,
            location: userLocation || "Gujarat"
          });
          if (isMounted && Array.isArray(batchRes.data) && batchRes.data.length > 0) {
            const formatted = batchRes.data.map(d => ({
              crop: d.crop || d.crop_name,
              price: `₹${Number(d.modal_price_per_quintal || 2500).toLocaleString('en-IN')}/quintal`,
              trend: "+3.2%"
            }));
            setMarketPrices(formatted);
            setMarketLoading(false);
            return;
          }
        } catch (batchErr) {
          // Fallback to individual requests if needed
        }

        const promises = activeCrops.map(async (crop) => {
          try {
            const res = await apiClient.post('/market/prices', {
              crop_name: crop,
              location: userLocation || "Gujarat"
            });
            const price = res.data.modal_price_per_quintal;
            const currency = "₹";
            const unit = "/quintal";
            return {
              crop: crop,
              price: price ? `${currency}${Number(price).toLocaleString('en-IN')}${unit}` : `${currency}2,500${unit}`,
              trend: "+3.2%"
            };
          } catch (e) {
            console.error(`Failed to fetch price for ${crop}:`, e);
            return {
              crop: crop,
              price: "₹2,500/quintal",
              trend: "+3.2%"
            };
          }
        });
        const results = await Promise.all(promises);
        const validResults = results.filter(Boolean);
        if (isMounted && validResults.length > 0) {
          setMarketPrices(validResults);
        }
      } catch (err) {
        console.error("Failed to fetch market prices:", err);
      } finally {
        if (isMounted) {
          setMarketLoading(false);
        }
      }
    };

    fetchMarketPrices();

    return () => {
      isMounted = false;
    };
  }, [userLocation, cropsKey]);

  useEffect(() => {
    const fetchReminders = async () => {
      try {
        const res = await apiClient.get('/reminders');
        if (res.data && res.data.length > 0) {
          const formatted = res.data.map(rem => {
            const dt = new Date(rem.target_timestamp * 1000);
            const dateStr = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            return {
              title: rem.title,
              date: `${dateStr} • ${rem.category}`
            };
          });
          setReminders(formatted);
        }
      } catch (err) {
        console.error("Failed to fetch reminders:", err);
      }
    };
    if (profile) {
      fetchReminders();
    }
  }, [profile]);

  const nValue = profile?.soil_profile?.nitrogen || 65;
  const barHeight = `${Math.min(Math.max(nValue, 20), 100) * 1.5}px`;

  return (
    <AppLayout>
      <div className="p-8 h-full overflow-y-auto space-y-8 pb-20">

        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-extrabold tracking-tight grad-text">
              Farming Workspace
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              Hi {profile?.fullname || 'Farmer'}, here is your real-time farm overview.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold uppercase bg-primary/10 text-primary dark:bg-primary/20 dark:text-green-400 px-4 py-2 rounded-xl border border-primary/20">
            <MapPin size={14} className={`shrink-0 ${detecting ? 'animate-pulse text-amber-500' : ''}`} />
            {isEditingLocation ? (
              <input
                type="text"
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onBlur={() => handleLocationSubmit(locationInput)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleLocationSubmit(locationInput);
                  } else if (e.key === 'Escape') {
                    setIsEditingLocation(false);
                  }
                }}
                className="bg-transparent border-none outline-none text-xs font-bold uppercase w-36 text-primary dark:text-green-400"
                autoFocus
              />
            ) : (
              <span
                onClick={() => { setIsEditingLocation(true); setLocationInput(userLocation && userLocation !== 'Detecting location...' ? userLocation : ''); }}
                className="cursor-pointer hover:underline truncate max-w-[180px]"
                title="Click to edit location"
              >
                {detecting ? 'Detecting GPS...' : (userLocation || 'Set Location')}
              </span>
            )}
            <button
              onClick={refreshLocation}
              disabled={detecting}
              className="ml-1 p-1 hover:bg-primary/15 rounded-md transition-colors disabled:opacity-50"
              title="Detect GPS location"
            >
              <RefreshCw size={12} className={detecting ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Top Summaries Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 rounded-3xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-40">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Tractor size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase">Total farm area</p>
              <p className="text-2xl font-black mt-1">{profile?.farm_size_hectares || "12"} Hectares</p>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-40">
            <div className="w-10 h-10 rounded-2xl bg-sky-500/10 text-sky-500 flex items-center justify-center">
              <Wind size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase">Today's weather</p>
              <p className="text-2xl font-black mt-1">{weather.temp} • {weather.condition}</p>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-40">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Sprout size={20} />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-bold uppercase">Crops Active</p>
              <p className="text-2xl font-black mt-1 truncate">{activeCrops.join(', ')}</p>
            </div>
          </div>

          <div className="p-6 rounded-3xl border border-primary/20 bg-primary/5 dark:bg-primary/10 shadow-sm hover:shadow-md transition-all flex flex-col justify-between h-40">
            <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles size={20} />
            </div>
            <div>
              <p className="text-xs text-primary dark:text-green-400 font-bold uppercase">AI Suggestions</p>
              <p className="text-2xl font-black mt-1 text-primary dark:text-white">3 Actionable Recommendations</p>
            </div>
          </div>
        </div>

        {/* Suggestion Logs & Pricing Trends */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* AI Suggestions column */}
          <div className="md:col-span-2 p-6 rounded-[32px] border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface space-y-4">
            <h3 className="text-lg font-extrabold flex items-center gap-2 text-gray-800 dark:text-white">
              <Lightbulb size={20} className="text-accent-gold" />
              Actionable AI Recommendations
            </h3>
            <div className="space-y-3">
              {suggestions.map((s, idx) => (
                <div key={idx} className="p-4 bg-gray-50 dark:bg-dark-bg/60 border border-gray-150 dark:border-dark-border rounded-2xl flex items-start gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${s.priority === 'high' ? 'bg-red-500' : s.priority === 'warning' ? 'bg-accent-gold' : 'bg-primary'}`}></span>
                  <div>
                    <h4 className="font-bold text-xs text-gray-800 dark:text-gray-200">{s.title}</h4>
                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Markets overview Column */}
          <div className="p-6 rounded-[32px] border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface space-y-4">
            <h3 className="text-lg font-extrabold flex items-center gap-2 text-gray-800 dark:text-white">
              <TrendingUp size={20} className="text-primary" />
              Wholesale Market Preview
            </h3>
            <div className="space-y-3">
              {marketLoading ? (
                [1, 2, 3].map(i => (
                  <div key={i} className="p-3.5 bg-gray-50 dark:bg-dark-bg/60 rounded-2xl border border-gray-150 dark:border-dark-border animate-pulse flex justify-between items-center">
                    <div className="space-y-1.5 w-1/2">
                      <div className="h-3 bg-gray-200 dark:bg-dark-border rounded w-3/4"></div>
                      <div className="h-2 bg-gray-200 dark:bg-dark-border rounded w-1/2"></div>
                    </div>
                    <div className="h-4 bg-gray-200 dark:bg-dark-border rounded w-1/4"></div>
                  </div>
                ))
              ) : marketPrices.length === 0 ? (
                <div className="p-4 text-center text-xs text-gray-400">
                  No price quotes available for selected crops.
                </div>
              ) : (
                marketPrices.map((p, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3.5 bg-gray-50 dark:bg-dark-bg/60 rounded-2xl border border-gray-150 dark:border-dark-border">
                    <div>
                      <p className="font-bold text-xs text-gray-800 dark:text-gray-200">{p.crop}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">Average regional quote</p>
                    </div>
                    <div className="text-right">
                      <p className="font-extrabold text-sm text-gray-800 dark:text-gray-200">{p.price}</p>
                      <span className={`text-[10px] font-bold ${p.trend.startsWith('+') ? 'text-green-500' : 'text-red-500'}`}>{p.trend}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
            <button
              onClick={() => navigate('/market')}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-dark-bg dark:hover:bg-dark-border rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 flex items-center justify-center gap-1.5 transition-colors"
            >
              Open Prices Dashboard
              <ArrowRight size={14} />
            </button>
          </div>

        </div>

        {/* Charts & Soil comp maps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Custom SVG mockup Chart */}
          <div className="md:col-span-2 p-6 rounded-[32px] border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface space-y-4">
            <h3 className="text-lg font-extrabold text-gray-800 dark:text-white">Nitrogen Levels Trend (Block A)</h3>
            <div className="h-48 w-full flex items-end justify-between px-4 pb-2 relative bg-gray-50 dark:bg-dark-bg/40 rounded-2xl border border-gray-100 dark:border-dark-border pt-4">
              {/* Dummy chart bars */}
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary/20 dark:bg-primary/40 w-12 rounded-t-xl hover:bg-primary/40 transition-colors cursor-pointer" style={{ height: '80px' }}></div>
                <span className="text-[9px] font-bold text-gray-400">Week 1</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary/20 dark:bg-primary/40 w-12 rounded-t-xl hover:bg-primary/40 transition-colors cursor-pointer" style={{ height: '110px' }}></div>
                <span className="text-[9px] font-bold text-gray-400">Week 2</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary/20 dark:bg-primary/40 w-12 rounded-t-xl hover:bg-primary/40 transition-colors cursor-pointer" style={{ height: '90px' }}></div>
                <span className="text-[9px] font-bold text-gray-400">Week 3</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-primary w-12 rounded-t-xl hover:bg-primary-dark transition-colors cursor-pointer" style={{ height: barHeight }}></div>
                <span className="text-[9px] font-bold text-primary dark:text-green-400">Today ({nValue}%)</span>
              </div>
            </div>
          </div>

          {/* Calendar stubs */}
          <div className="p-6 rounded-[32px] border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface space-y-4">
            <h3 className="text-lg font-extrabold flex items-center gap-2 text-gray-800 dark:text-white">
              <Calendar size={20} className="text-primary" />
              Agricultural Calendar
            </h3>
            <div className="space-y-3">
              {reminders.map((rem, idx) => (
                <div key={idx} className="p-3 bg-[#F8FAF8] dark:bg-dark-bg/60 border-l-4 border-primary rounded-r-2xl text-xs">
                  <p className="font-bold text-gray-800 dark:text-gray-200">{rem.title}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{rem.date}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </AppLayout>
  );
};

export default Dashboard;
