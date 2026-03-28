import React, { useState, useEffect } from 'react';
import { Search, MapPin, Star, Utensils, Loader2, Sparkles, X, ExternalLink, Navigation, Info, AlertCircle, ChefHat } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { discoverFood, FoodDiscoveryResponse, DishSuggestion, getLocationSuggestions, LocationSuggestion } from './services/geminiService';
import { VEG_FOOD_IMAGES, NON_VEG_FOOD_IMAGES } from './constants';

export default function App() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<DishSuggestion[]>([]);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationName, setLocationName] = useState<string>('Detecting location...');
  const [activeFilters, setActiveFilters] = useState<FoodDiscoveryResponse['filters'] | null>(null);
  const [isManualLocation, setIsManualLocation] = useState(false);
  const [manualCity, setManualCity] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [isFetchingLocations, setIsFetchingLocations] = useState(false);
  const [selectedCuisine, setSelectedCuisine] = useState<string | null>(null);
  const [selectedDiet, setSelectedDiet] = useState<'veg' | 'non-veg' | null>(null);
  const searchIdRef = React.useRef(0);

  const CUISINES = [
    { name: 'Indian', icon: '🍛' },
    { name: 'Chinese', icon: '🥢' },
    { name: 'Italian', icon: '🍕' },
    { name: 'Mexican', icon: '🌮' },
    { name: 'Japanese', icon: '🍣' },
    { name: 'Continental', icon: '🍽️' },
    { name: 'Thai', icon: '🍜' },
    { name: 'Desserts', icon: '🍰' }
  ];

  const FOOD_PHOTOS = [
    { name: "Pizza", url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80" },
    { name: "Burger", url: "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce?auto=format&fit=crop&w=400&q=80" },
    { name: "Sushi", url: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?auto=format&fit=crop&w=400&q=80" },
    { name: "Salad", url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80" },
    { name: "Tacos", url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=400&q=80" },
    { name: "Indian Thali", url: "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=400&q=80" },
  ];

  // Detect location on mount
  useEffect(() => {
    detectLocation();
  }, []);

  // Update suggestions when typing with debouncing
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (manualCity.length > 2) {
        setIsFetchingLocations(true);
        try {
          const suggestions = await getLocationSuggestions(manualCity);
          setLocationSuggestions(suggestions);
        } catch (err) {
          console.error("Failed to fetch locations:", err);
        } finally {
          setIsFetchingLocations(false);
        }
      } else {
        setLocationSuggestions([]);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [manualCity]);

  const detectLocation = () => {
    setLocationName('Detecting location...');
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationName('Current Location');
          setIsManualLocation(false);
        },
        (error) => {
          console.error("Error getting location:", error);
          // Default to Mumbai for demo if GPS fails
          setUserLocation({ lat: 19.0760, lng: 72.8777 });
          setLocationName('Mumbai (Default)');
        }
      );
    } else {
      setUserLocation({ lat: 19.0760, lng: 72.8777 });
      setLocationName('Mumbai (Default)');
    }
  };

  const selectCity = (city: { name: string; lat: number; lng: number }) => {
    setUserLocation({ lat: city.lat, lng: city.lng });
    setLocationName(city.name);
    setIsManualLocation(false);
    setManualCity('');
    setLocationSuggestions([]);
  };

  const handleManualLocation = async (e?: React.FormEvent | React.MouseEvent, selectedCity?: LocationSuggestion) => {
    if (e) e.preventDefault();
    
    let cityToSet = '';
    let lat = 0;
    let lng = 0;

    if (selectedCity) {
      cityToSet = selectedCity.name;
      lat = selectedCity.lat;
      lng = selectedCity.lng;
    } else if (manualCity.trim()) {
      // If no suggestion selected, try to use the first suggestion if available
      if (locationSuggestions.length > 0) {
        const first = locationSuggestions[0];
        cityToSet = first.name;
        lat = first.lat;
        lng = first.lng;
      } else {
        // Fallback: search for the city again to get coordinates
        setIsFetchingLocations(true);
        try {
          const suggestions = await getLocationSuggestions(manualCity);
          if (suggestions.length > 0) {
            const first = suggestions[0];
            cityToSet = first.name;
            lat = first.lat;
            lng = first.lng;
          } else {
            cityToSet = manualCity;
          }
        } catch (err) {
          cityToSet = manualCity;
        } finally {
          setIsFetchingLocations(false);
        }
      }
    }

    if (!cityToSet) return;
    
    setLocationName(cityToSet);
    if (lat && lng) {
      setUserLocation({ lat, lng });
    }
    setIsManualLocation(false);
    setManualCity('');
    setLocationSuggestions([]);
  };

  const handleSearch = async (e?: React.FormEvent, overrideQuery?: string, overrideCuisine?: string, overrideDiet?: 'veg' | 'non-veg' | null) => {
    if (e) e.preventDefault();
    const searchQuery = overrideQuery || query;
    const searchCuisine = overrideCuisine !== undefined ? overrideCuisine : selectedCuisine;
    const searchDiet = overrideDiet !== undefined ? overrideDiet : selectedDiet;
    
    if (!searchQuery.trim() && !searchCuisine && !searchDiet) return;

    const currentSearchId = ++searchIdRef.current;
    setIsSearching(true);
    setError(null);
    try {
      // Use the new discoverFood service which uses Google Maps and Search grounding
      const response = await discoverFood(
        searchQuery || "best food", 
        userLocation, 
        searchCuisine || undefined,
        searchDiet || undefined
      );
      
      if (currentSearchId === searchIdRef.current) {
        setResults(response.dishes);
        setAiResponse(response.explanation);
        setActiveFilters(response.filters);
      }
    } catch (err: any) {
      if (currentSearchId === searchIdRef.current) {
        console.error("Search failed:", err);
        setError(err.message || "Something went wrong while searching. Please try again.");
      }
    } finally {
      if (currentSearchId === searchIdRef.current) {
        setIsSearching(false);
      }
    }
  };

  const cancelSearch = () => {
    searchIdRef.current++;
    setIsSearching(false);
  };

  const clearSearch = () => {
    setQuery('');
    setSelectedCuisine(null);
    setSelectedDiet(null);
    setResults([]);
    setActiveFilters(null);
    setAiResponse(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F5] text-[#1A1A1A] font-sans selection:bg-[#FF6321] selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FF6321] rounded-lg flex items-center justify-center text-white font-bold text-xl">
              Z
            </div>
            <h1 className="text-xl font-bold tracking-tight">Zwiggy AI</h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsManualLocation(true)}
              className="flex items-center gap-2 text-sm font-bold text-gray-700 bg-gray-50 border-2 border-gray-100 px-4 py-2.5 rounded-2xl hover:border-[#FF6321] hover:text-[#FF6321] hover:bg-white transition-all shadow-sm group"
            >
              <div className="w-6 h-6 bg-[#FF6321]/10 rounded-lg flex items-center justify-center text-[#FF6321] group-hover:bg-[#FF6321] group-hover:text-white transition-colors">
                <MapPin size={14} />
              </div>
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Location</span>
                <span className="max-w-[100px] md:max-w-[150px] truncate">{locationName}</span>
              </div>
              <Search size={14} className="text-gray-300 ml-1 group-hover:text-[#FF6321]" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 md:py-16">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-bold mb-4 tracking-tight"
          >
            Discover the best <br />
            <span className="text-[#FF6321]">dishes around you.</span>
          </motion.h2>
        </div>

        {/* Search Bar */}
        <div className="relative mb-16">
          <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-visible mb-6">
            {/* Food Search Part */}
            <form onSubmit={handleSearch} className="relative flex items-center group/food">
              <div className="pl-6 text-gray-400 group-focus-within/food:text-[#FF6321] transition-colors">
                <Search size={24} />
              </div>
              <div className="flex flex-col flex-1 py-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-3 group-focus-within/food:text-[#FF6321] transition-colors">Cravings</span>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder='Search for dishes or restaurants...'
                  className="w-full h-12 pl-3 pr-32 outline-none text-xl font-medium transition-all placeholder:text-gray-300 rounded-3xl"
                />
              </div>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                {query && (
                  <button 
                    type="button"
                    onClick={clearSearch}
                    className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={20} />
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSearching || (!query.trim() && !selectedCuisine && !selectedDiet)}
                  className="bg-[#FF6321] text-white px-8 py-3 rounded-2xl font-bold hover:bg-[#E5591E] transition-all shadow-lg shadow-[#FF6321]/20 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSearching ? <Loader2 className="animate-spin" size={20} /> : "Find"}
                </button>
              </div>
            </form>
          </div>

          {/* Diet Filters */}
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => {
                const newDiet = selectedDiet === 'veg' ? null : 'veg';
                setSelectedDiet(newDiet);
                handleSearch(undefined, query, undefined, newDiet);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border-2 ${
                selectedDiet === 'veg'
                ? 'bg-green-600 border-green-600 text-white shadow-lg shadow-green-600/20'
                : 'bg-white border-gray-100 text-gray-600 hover:border-green-100'
              }`}
            >
              <div className={`w-4 h-4 border-2 flex items-center justify-center ${selectedDiet === 'veg' ? 'border-white' : 'border-green-600'}`}>
                <div className={`w-2 h-2 rounded-full ${selectedDiet === 'veg' ? 'bg-white' : 'bg-green-600'}`}></div>
              </div>
              Veg Only
            </button>
            <button
              onClick={() => {
                const newDiet = selectedDiet === 'non-veg' ? null : 'non-veg';
                setSelectedDiet(newDiet);
                handleSearch(undefined, query, undefined, newDiet);
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all border-2 ${
                selectedDiet === 'non-veg'
                ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-600/20'
                : 'bg-white border-gray-100 text-gray-600 hover:border-red-100'
              }`}
            >
              <div className={`w-4 h-4 border-2 flex items-center justify-center ${selectedDiet === 'non-veg' ? 'border-white' : 'border-red-600'}`}>
                <div className={`w-2 h-2 ${selectedDiet === 'non-veg' ? 'bg-white' : 'bg-red-600'}`} style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }}></div>
              </div>
              Non-Veg Mix
            </button>
          </div>

          {/* Cuisine Filters */}
          <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar mb-6">
            <button
              onClick={() => {
                setSelectedCuisine(null);
                handleSearch(undefined, query, null, selectedDiet);
              }}
              className={`whitespace-nowrap px-5 py-2.5 rounded-2xl font-bold text-sm transition-all border-2 ${
                selectedCuisine === null 
                ? 'bg-[#FF6321] border-[#FF6321] text-white shadow-lg shadow-[#FF6321]/20' 
                : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
              }`}
            >
              All Cuisines
            </button>
            {CUISINES.map((cuisine) => (
              <button
                key={cuisine.name}
                onClick={() => {
                  const newCuisine = selectedCuisine === cuisine.name ? null : cuisine.name;
                  setSelectedCuisine(newCuisine);
                  handleSearch(undefined, query, newCuisine || undefined, selectedDiet);
                }}
                className={`whitespace-nowrap px-5 py-2.5 rounded-2xl font-bold text-sm transition-all border-2 flex items-center gap-2 ${
                  selectedCuisine === cuisine.name 
                  ? 'bg-[#FF6321] border-[#FF6321] text-white shadow-lg shadow-[#FF6321]/20' 
                  : 'bg-white border-gray-100 text-gray-500 hover:border-gray-200'
                }`}
              >
                <span>{cuisine.icon}</span>
                <span>{cuisine.name}</span>
              </button>
            ))}
          </div>

          {/* Quick Suggestions */}
          {!results.length && !isSearching && (
            <div className="mt-6 flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
                <MapPin size={12} className="text-[#FF6321]" />
                <span>Searching near {locationName}</span>
                <button 
                  onClick={() => setIsManualLocation(true)}
                  className="text-[#FF6321] hover:underline normal-case ml-1"
                >
                  (Change)
                </button>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                {["Best Biryani nearby", "Healthy cafes in Delhi", "Late night snacks", "Spicy Chinese"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => {
                      setQuery(suggestion);
                      setSelectedCuisine(null);
                      setSelectedDiet(null);
                      handleSearch(undefined, suggestion, null, null);
                    }}
                    className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-full hover:border-[#FF6321] hover:text-[#FF6321] transition-all"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {error ? (
            <motion.div 
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-50 border border-red-100 p-6 rounded-2xl text-center"
            >
              <AlertCircle className="text-red-500 mx-auto mb-4" size={32} />
              <h3 className="text-lg font-bold text-red-800 mb-2">Search Error</h3>
              <p className="text-red-600 text-sm mb-4">{error}</p>
              <button 
                onClick={() => handleSearch()}
                className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-bold hover:bg-red-200 transition-colors"
              >
                Try Again
              </button>
            </motion.div>
          ) : isSearching ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-[#FF6321]/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-[#FF6321] border-t-transparent rounded-full animate-spin"></div>
                <Sparkles className="absolute inset-0 m-auto text-[#FF6321] animate-pulse" size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">Searching Google Maps...</h3>
              <p className="text-gray-500 mb-8">Fetching real-time results for your craving</p>
              
              <button
                onClick={cancelSearch}
                className="flex items-center gap-2 px-6 py-3 bg-white border-2 border-gray-100 text-gray-600 font-bold rounded-2xl hover:border-red-100 hover:text-red-600 transition-all shadow-sm"
              >
                <X size={18} />
                Cancel Search
              </button>
            </motion.div>
          ) : aiResponse ? (
            <motion.div 
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-8"
            >
              {/* AI Markdown Response */}
              <div className="bg-white rounded-3xl p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 bg-[#FF6321]/10 rounded-full flex items-center justify-center">
                    <Sparkles className="text-[#FF6321]" size={18} />
                  </div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400">
                    Zwiggy AI Assistant
                  </h3>
                </div>
                
                <div className="prose prose-sm max-w-none prose-p:text-gray-600 prose-p:leading-relaxed prose-headings:text-[#1A1A1A] prose-strong:text-[#FF6321] prose-ul:list-disc prose-li:text-gray-600">
                  <ReactMarkdown>{aiResponse}</ReactMarkdown>
                </div>
              </div>

              {/* Structured Results (Map Links) */}
              {results.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
                    <ChefHat size={16} />
                    Where to find these dishes
                  </h3>
                  
                  <div className="grid gap-6">
                    {results.map((dish, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="group bg-white rounded-[2rem] overflow-hidden border border-gray-100 hover:border-[#FF6321]/30 hover:shadow-2xl transition-all flex flex-col sm:flex-row shadow-sm"
                      >
                        {dish.image && (
                          <div className="w-full sm:w-56 h-48 sm:h-auto relative overflow-hidden shrink-0">
                            <img 
                              src={dish.image} 
                              alt={dish.dishName} 
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                // Fallback to a high-quality food photo from our curated pool if the specific one fails
                                const pool = dish.diet === 'veg' ? VEG_FOOD_IMAGES : NON_VEG_FOOD_IMAGES;
                                const fallbackIndex = Math.abs(dish.restaurantName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % pool.length;
                                (e.target as HTMLImageElement).src = pool[fallbackIndex];
                              }}
                            />
                            <div className="absolute top-4 left-4">
                              <span className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl text-[10px] font-black text-[#FF6321] shadow-xl uppercase tracking-[0.15em] border border-white/20">
                                {dish.dishName}
                              </span>
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                          </div>
                        )}
                        
                        <div className="flex-1 p-6 sm:p-8 flex flex-col">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h4 className="font-bold text-xl sm:text-2xl text-gray-900 group-hover:text-[#FF6321] transition-colors leading-tight mb-1">
                                {dish.restaurantName}
                              </h4>
                              <div className="flex items-center gap-3">
                                {dish.rating && (
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex text-yellow-400">
                                      {[...Array(5)].map((_, i) => (
                                        <Star 
                                          key={i} 
                                          size={12} 
                                          fill={i < Math.floor(dish.rating || 0) ? "currentColor" : "none"} 
                                          className={i < Math.floor(dish.rating || 0) ? "text-yellow-400" : "text-gray-200"}
                                        />
                                      ))}
                                    </div>
                                    <span className="text-xs font-bold text-gray-600">{dish.rating}</span>
                                  </div>
                                )}
                                {dish.price && (
                                  <span className="text-xs font-bold text-[#FF6321] bg-[#FF6321]/5 px-2 py-0.5 rounded-lg">
                                    {dish.price}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-sm sm:text-base text-gray-500 line-clamp-2 mb-6 leading-relaxed">
                            {dish.description}
                          </p>

                          <div className="flex items-center justify-between mt-auto pt-6 border-t border-gray-50">
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Open Now
                              </span>
                            </div>
                            
                            <a 
                              href={dish.mapsUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 px-6 py-3 bg-gray-50 text-[#FF6321] rounded-2xl font-bold text-sm group-hover:bg-[#FF6321] group-hover:text-white transition-all shadow-sm active:scale-95"
                            >
                              <span>View on Maps</span>
                              <ExternalLink size={16} />
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Return to Home Button */}
                  <div className="flex justify-center pt-12 pb-8">
                    <button
                      onClick={clearSearch}
                      className="flex items-center gap-3 px-8 py-4 bg-white border-2 border-gray-100 text-gray-900 rounded-[2rem] font-bold hover:border-[#FF6321] hover:text-[#FF6321] transition-all shadow-sm hover:shadow-xl active:scale-95 group"
                    >
                      <div className="p-2 bg-gray-50 rounded-xl group-hover:bg-[#FF6321]/10 transition-colors">
                        <Search size={20} className="group-hover:scale-110 transition-transform" />
                      </div>
                      <span>Search Something Else</span>
                    </button>
                  </div>
                </div>
              )}

              {results.length === 0 && (
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex gap-3 items-start">
                  <Info className="text-blue-500 shrink-0 mt-0.5" size={18} />
                  <p className="text-sm text-blue-700">
                    I found some information for you, but I couldn't pin specific locations on the map. Try being more specific with a city or neighborhood!
                  </p>
                </div>
              )}
            </motion.div>
          ) : query && !isSearching ? (
            <motion.div 
              key="no-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-20 text-center"
            >
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                <Search size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">No results found on Maps</h3>
              <p className="text-gray-500">Try adjusting your query or changing your location.</p>
              <button 
                onClick={clearSearch}
                className="mt-6 text-[#FF6321] font-bold hover:underline"
              >
                Clear search
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-12 text-center relative"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
                {FOOD_PHOTOS.map((item, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1 }}
                    onClick={() => {
                      setQuery(item.name);
                      setSelectedCuisine(null);
                      setSelectedDiet(null);
                      handleSearch(undefined, item.name, null, null);
                    }}
                    className="relative aspect-square rounded-3xl overflow-hidden shadow-lg group cursor-pointer"
                  >
                    <img 
                      src={item.url} 
                      alt={item.name} 
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-6">
                      <p className="text-white text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60 group-hover:opacity-100 transition-opacity">Trending Now</p>
                      <p className="text-white text-xl font-bold tracking-tight">{item.name}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="flex flex-col items-center justify-center">
                <p className="text-gray-400 font-medium bg-white/80 backdrop-blur-sm px-6 py-2 rounded-full shadow-sm border border-gray-100">
                  Search for real restaurants nearby
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-3xl mx-auto px-4 py-12 border-t border-gray-200 text-center">
        <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">
          Powered by snacks, code, and vibes
        </p>
      </footer>

      {/* Location Modal - Root Level */}
      <AnimatePresence>
        {isManualLocation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsManualLocation(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Fixed Header with Search */}
              <div className="p-8 border-b border-gray-100 bg-white z-20">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Select Location</h3>
                    <p className="text-sm text-gray-500">Find the best food in your area</p>
                  </div>
                  <button 
                    onClick={() => setIsManualLocation(false)}
                    className="p-3 hover:bg-gray-100 rounded-2xl transition-colors text-gray-400 hover:text-gray-900"
                  >
                    <X size={24} />
                  </button>
                </div>

                <div className="relative">
                  <p className="text-[10px] font-bold text-[#FF6321] uppercase tracking-widest mb-3 px-1">Search for any city or area</p>
                  <form onSubmit={(e) => handleManualLocation(e)} className="relative flex flex-col sm:flex-row items-stretch gap-3">
                    <div className="relative flex-1">
                      <input 
                        type="text" 
                        placeholder="e.g. Indiranagar, Bangalore"
                        value={manualCity}
                        onChange={(e) => setManualCity(e.target.value)}
                        className="w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-transparent rounded-2xl text-base outline-none focus:bg-white focus:border-[#FF6321] transition-all shadow-inner"
                        autoFocus
                      />
                      <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                      {manualCity && (
                        <button 
                          type="button"
                          onClick={() => {
                            setManualCity('');
                            setLocationSuggestions([]);
                          }}
                          className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 hover:bg-gray-200 rounded-full transition-colors"
                        >
                          <X size={16} className="text-gray-400" />
                        </button>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={!manualCity.trim() || isFetchingLocations}
                      className="bg-[#FF6321] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#E5591E] transition-all shadow-lg shadow-[#FF6321]/20 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
                    >
                      {isFetchingLocations ? <Loader2 className="animate-spin" size={20} /> : <Search size={20} />}
                      <span>Search</span>
                    </button>

                    {/* Location Suggestions Dropdown */}
                    <AnimatePresence>
                      {(locationSuggestions.length > 0 || (isFetchingLocations && manualCity.length > 2) || (!isFetchingLocations && locationSuggestions.length === 0 && manualCity.length > 2)) && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute z-[110] left-0 right-0 top-full mt-3 bg-white border border-gray-100 rounded-3xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto"
                        >
                            {isFetchingLocations && (
                              <div className="p-5 text-center text-sm text-gray-500 flex items-center justify-center gap-3 bg-gray-50/50">
                                <Loader2 className="animate-spin text-[#FF6321]" size={20} />
                                <span>Finding locations...</span>
                              </div>
                            )}
                            
                            {locationSuggestions.map((suggestion) => (
                              <button
                                key={suggestion.name + suggestion.address}
                                type="button"
                                onClick={() => handleManualLocation(undefined, suggestion)}
                                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#FF6321]/5 text-left transition-colors border-b border-gray-50 last:border-0 group"
                              >
                                <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-white transition-colors">
                                  <MapPin size={18} className="text-gray-400 group-hover:text-[#FF6321]" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-sm font-bold text-gray-900 group-hover:text-[#FF6321]">{suggestion.name}</span>
                                  {suggestion.address && <span className="text-[11px] text-gray-500 truncate max-w-[320px]">{suggestion.address}</span>}
                                </div>
                              </button>
                            ))}

                            {!isFetchingLocations && locationSuggestions.length === 0 && manualCity.length > 2 && (
                              <div className="p-10 text-center bg-gray-50/30">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <MapPin size={32} className="text-gray-300" />
                                </div>
                                <p className="text-base font-bold text-gray-900">No locations found</p>
                                <p className="text-sm text-gray-500 mt-1">Try searching for a different city or area</p>
                              </div>
                            )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </form>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-gray-50/30">
                <div className="space-y-10">
                  {/* GPS Section */}
                  <button 
                    onClick={detectLocation}
                    className="w-full flex items-center gap-5 p-5 text-lg font-bold text-[#FF6321] bg-white border-2 border-[#FF6321]/10 hover:border-[#FF6321] hover:bg-white rounded-3xl transition-all group shadow-sm"
                  >
                    <div className="w-12 h-12 bg-[#FF6321] text-white rounded-2xl flex items-center justify-center shadow-lg shadow-[#FF6321]/20 group-hover:scale-110 transition-transform">
                      <Navigation size={22} />
                    </div>
                    <div className="flex-1 text-left">
                      <p>Detect my current location</p>
                      <p className="text-xs font-normal text-gray-500 mt-0.5">Using GPS for precise results</p>
                    </div>
                  </button>

                  {/* Popular Cities Section */}
                  <div>
                    <div className="flex items-center gap-3 mb-6 px-1">
                      <div className="h-px flex-1 bg-gray-200"></div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Popular Cities</p>
                      <div className="h-px flex-1 bg-gray-200"></div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {[
                        { name: 'Mumbai', lat: 19.0760, lng: 72.8777 },
                        { name: 'Delhi', lat: 28.6139, lng: 77.2090 },
                        { name: 'Bangalore', lat: 12.9716, lng: 77.5946 },
                        { name: 'Hyderabad', lat: 17.3850, lng: 78.4867 },
                        { name: 'Chennai', lat: 13.0827, lng: 80.2707 },
                        { name: 'Kolkata', lat: 22.5726, lng: 88.3639 }
                      ].map((city) => (
                        <button
                          key={city.name}
                          onClick={() => selectCity(city)}
                          className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl border-2 border-white bg-white hover:border-[#FF6321] hover:bg-[#FF6321]/5 hover:text-[#FF6321] transition-all group shadow-sm"
                        >
                          <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center group-hover:bg-white transition-colors">
                            <MapPin size={20} className="text-gray-400 group-hover:text-[#FF6321]" />
                          </div>
                          <span className="text-sm font-bold">{city.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
