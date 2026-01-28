"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Popup from "@/components/Popup";
import * as XLSX from "xlsx";
import Papa from "papaparse";

interface StockItem {
  link_url?: string;
  image_url?: string;
  warehouse?: string;
  sku: string;
  SKU?: string;
  stock: string;
  Stock?: string;
  item_name: string;
  Product_name?: string;
  category: string;
  Category?: string;
  grade: string;
  Grade?: string;
  hpp: string;
  HPP?: string;
  hpt: string;
  HPT?: string;
  hpj: string;
  HPJ?: string;
  Artikel?: string;
}

interface LastUpdate {
  type: string;
  last_update: string;
}

export default function StockPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [data, setData] = useState<StockItem[]>([]);
  const [filteredData, setFilteredData] = useState<StockItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<LastUpdate[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [grades, setGrades] = useState<string[]>([]);
  const [warehouses, setWarehouses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<'store' | 'pca' | 'master'>('store');
  
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [gradeFilter, setGradeFilter] = useState<string[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState<string[]>([]);
  const [hpjFilter, setHpjFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showGradeDropdown, setShowGradeDropdown] = useState(false);
  const [showWarehouseDropdown, setShowWarehouseDropdown] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  const [erpFile, setErpFile] = useState<File | null>(null);
  const [javelinFile, setJavelinFile] = useState<File | null>(null);
  
  const [showPopup, setShowPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState("");
  const [popupType, setPopupType] = useState<"success" | "error">("success");
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.stock) {
      router.push("/dashboard");
      return;
    }
    setUser(parsedUser);
    
    // Set default view based on permissions
    if (parsedUser.stock_view_store) {
      setSelectedView('store');
    } else if (parsedUser.stock_view_pca) {
      setSelectedView('pca');
    } else if (parsedUser.stock_view_master) {
      setSelectedView('master');
    }
    
    fetchData();
    fetchLastUpdate();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedView]);

  useEffect(() => {
    applyFilters();
  }, [categoryFilter, gradeFilter, warehouseFilter, hpjFilter, searchQuery, data]);

  const showMessage = (message: string, type: "success" | "error") => {
    setPopupMessage(message);
    setPopupType(type);
    setShowPopup(true);
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      let sheetName = 'result_stock';
      if (selectedView === 'pca') sheetName = 'pca_stock';
      if (selectedView === 'master') sheetName = 'master_item';
      
      console.log('Fetching data for:', sheetName);
      const response = await fetch(`/api/stock?type=${sheetName}`);
      const result = await response.json();
      console.log('Data received:', result.length, 'items');
      
      const normalizedData = result.map((item: any) => ({
        ...item,
        sku: item.sku || item.SKU || '',
        stock: item.stock || item.Stock || '',
        item_name: item.item_name || item.Product_name || '',
        category: item.category || item.Category || '',
        grade: item.grade || item.Grade || '',
        hpp: item.hpp || item.HPP || '',
        hpt: item.hpt || item.HPT || '',
        hpj: item.hpj || item.HPJ || '',
      }));
      
      setData(normalizedData);
      setFilteredData(normalizedData);
      
      const uniqueCategories = [...new Set(normalizedData.map((item: StockItem) => item.category))].filter(Boolean);
      setCategories(uniqueCategories as string[]);
      
      const uniqueGrades = [...new Set(normalizedData.map((item: StockItem) => item.grade))].filter(Boolean);
      setGrades(uniqueGrades as string[]);
      
      if (selectedView === 'store') {
        const uniqueWarehouses = [...new Set(normalizedData.map((item: StockItem) => item.warehouse))].filter(Boolean);
        setWarehouses(uniqueWarehouses as string[]);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      showMessage("Failed to fetch data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchLastUpdate = async () => {
    try {
      const response = await fetch('/api/stock/last-update');
      const result = await response.json();
      setLastUpdate(result);
    } catch (error) {
      console.error('Failed to fetch last update');
    }
  };

  const handleRefreshJavelin = async () => {
    if (!confirm("Refresh Javelin data? This may take a few minutes.")) return;
    
    setRefreshing(true);
    try {
      const response = await fetch('/api/stock/javelin-refresh', {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (response.ok && result.success) {
        showMessage(`✅ Javelin data refreshed successfully!\n${result.rowsImported || 0} rows imported`, "success");
        fetchData();
        fetchLastUpdate();
      } else {
        if (result.needsConfiguration) {
          showMessage(`⚠️ ${result.error}\n\nPlease configure Javelin cookie in Settings first.`, "error");
        } else {
          showMessage(`❌ Failed to refresh Javelin data\n\n${result.details || result.error}`, "error");
        }
      }
    } catch (error) {
      showMessage("Failed to refresh Javelin data. Please try again.", "error");
    } finally {
      setRefreshing(false);
    }
  };

  const toProperCase = (str: string) => {
    if (!str) return '';
    return str
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const applyFilters = () => {
    let filtered = [...data];

    if (categoryFilter.length > 0) {
      filtered = filtered.filter((item) => categoryFilter.includes(item.category));
    }

    if (gradeFilter.length > 0) {
      filtered = filtered.filter((item) => gradeFilter.includes(item.grade));
    }

    if (selectedView === 'store' && warehouseFilter.length > 0) {
      filtered = filtered.filter((item) => item.warehouse && warehouseFilter.includes(item.warehouse));
    }

    if (hpjFilter) {
      const hpjValue = parseInt(hpjFilter.replace(/[^0-9]/g, ''));
      filtered = filtered.filter((item) => {
        const itemHpj = parseInt(item.hpj?.replace(/[^0-9]/g, '') || '0');
        return itemHpj <= hpjValue;
      });
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((item) => 
        (item.sku && item.sku.toLowerCase().includes(query)) || 
        (item.item_name && item.item_name.toLowerCase().includes(query))
      );
    }

    if (selectedView === 'pca') {
      filtered.sort((a, b) => {
        const stockA = parseInt(a.stock?.replace(/[^0-9]/g, '') || '0');
        const stockB = parseInt(b.stock?.replace(/[^0-9]/g, '') || '0');
        
        if (stockB !== stockA) {
          return stockB - stockA;
        }
        
        const gradeA = a.grade || '';
        const gradeB = b.grade || '';
        return gradeA.localeCompare(gradeB);
      });
    }

    setFilteredData(filtered);
    setCurrentPage(1);
  };

  const resetFilters = () => {
    setCategoryFilter([]);
    setGradeFilter([]);
    setWarehouseFilter([]);
    setHpjFilter("");
    setSearchQuery("");
    setFilteredData(data);
    setCurrentPage(1);
  };

  const toggleCategory = (category: string) => {
    setCategoryFilter(prev => 
      prev.includes(category) 
        ? prev.filter(c => c !== category)
        : [...prev, category]
    );
  };

  const toggleGrade = (grade: string) => {
    setGradeFilter(prev => 
      prev.includes(grade) 
        ? prev.filter(g => g !== grade)
        : [...prev, grade]
    );
  };

  const toggleWarehouse = (warehouse: string) => {
    setWarehouseFilter(prev => 
      prev.includes(warehouse) 
        ? prev.filter(w => w !== warehouse)
        : [...prev, warehouse]
    );
  };

  const parseFile = async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      if (file.name.endsWith(".csv")) {
        Papa.parse(file, {
          complete: (results) => {
            let parsedData = results.data as any[];
            parsedData = parsedData.filter(row => 
              Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '')
            );
            resolve(parsedData);
          },
          header: false,
          skipEmptyLines: true,
          error: (error) => reject(error)
        });
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: "binary" });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            let jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
            jsonData = jsonData.filter(row => 
              Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && cell !== '')
            );
            resolve(jsonData);
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsBinaryString(file);
      } else {
        reject(new Error("Unsupported file format"));
      }
    });
  };

  const handleImport = async () => {
    if (!erpFile && !javelinFile) {
      showMessage("Please select at least one file to import", "error");
      return;
    }

    setImporting(true);
    const results: string[] = [];
    const errors: string[] = [];

    try {
      if (erpFile) {
        try {
          const parsedData = await parseFile(erpFile);
          if (parsedData.length === 0) {
            errors.push("ERP Stock: No valid data found");
          } else {
            const response = await fetch('/api/stock/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sheetName: 'erp_stock_balance', data: parsedData })
            });
            
            if (response.ok) {
              const result = await response.json();
              results.push(`ERP Stock: ${result.rowsImported} rows imported`);
            } else {
              errors.push("ERP Stock: Import failed");
            }
          }
        } catch (error) {
          errors.push(`ERP Stock: ${error instanceof Error ? error.message : 'Import failed'}`);
        }
      }

      if (javelinFile) {
        try {
          const parsedData = await parseFile(javelinFile);
          if (parsedData.length === 0) {
            errors.push("Javelin: No valid data found");
          } else {
            const response = await fetch('/api/stock/import', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sheetName: 'javelin', data: parsedData })
            });
            
            if (response.ok) {
              const result = await response.json();
              results.push(`Javelin: ${result.rowsImported} rows imported`);
            } else {
              errors.push("Javelin: Import failed");
            }
          }
        } catch (error) {
          errors.push(`Javelin: ${error instanceof Error ? error.message : 'Import failed'}`);
        }
      }

      let message = "";
      if (results.length > 0) {
        message += "✅ Success:\n" + results.join("\n");
      }
      if (errors.length > 0) {
        message += (message ? "\n\n" : "") + "❌ Errors:\n" + errors.join("\n");
      }
      
      showMessage(message || "Import completed", results.length > 0 && errors.length === 0 ? "success" : "error");
      
      if (results.length > 0) {
        setShowImportModal(false);
        setErpFile(null);
        setJavelinFile(null);
        fetchData();
        fetchLastUpdate();
      }
    } catch (error) {
      showMessage("Failed to import data. Please try again.", "error");
    } finally {
      setImporting(false);
    }
  };

  const exportToExcel = () => {
    const exportData = filteredData.map((item) => {
      const base: any = {
        "SKU": item.sku,
        "Product Name": toProperCase(item.item_name),
        "Category": toProperCase(item.category),
        "Grade": toProperCase(item.grade),
      };
      
      if (selectedView !== 'master') {
        base["Stock"] = item.stock;
      }
      
      if (selectedView === 'store') {
        base["Warehouse"] = item.warehouse;
      }
      
      // Only add price columns if user has permission
      if (user?.stock_view_hpp) {
        base["HPP"] = item.hpp;
      }
      if (user?.stock_view_hpt) {
        base["HPT"] = item.hpt;
      }
      if (user?.stock_view_hpj) {
        base["HPJ"] = item.hpj;
      }
      
      return base;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Stock");
    XLSX.writeFile(wb, `stock_${selectedView}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Check if user can see any view
  const canSeeAnyView = user?.stock_view_store || user?.stock_view_pca || user?.stock_view_master;

  if (!user) return null;

  if (!canSeeAnyView) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar userName={user.name} permissions={user} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p className="text-lg font-semibold mb-2">No View Access</p>
            <p className="text-sm">You don't have permission to view any stock data.</p>
            <p className="text-sm">Please contact administrator.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />
      
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-6">Stock Management</h1>

          {/* Import/Export & Last Update & Refresh Javelin */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                {user.stock_import && (
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs hover:bg-gray-300 hover:text-black"
                  >
                    Import Data
                  </button>
                )}
                {user.stock_export && (
                  <button
                    onClick={exportToExcel}
                    className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs hover:bg-gray-300 hover:text-black"
                  >
                    Export Stock
                  </button>
                )}
                {user.stock_refresh_javelin && (
                  <button
                    onClick={handleRefreshJavelin}
                    disabled={refreshing}
                    className="px-4 py-1.5 bg-gray-700 text-white rounded text-xs hover:bg-gray-300 hover:text-black disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {refreshing ? "Refreshing..." : "Refresh Javelin"}
                  </button>
                )}
              </div>
              <div className="text-xs text-gray-600">
                {lastUpdate.map((lu) => (
                  <div key={lu.type}>
                    <span className="font-semibold">{lu.type}:</span> {lu.last_update}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* View Selection - Only show tabs user has access to */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <label className="block text-xs font-medium text-gray-700 mb-2">
              Select View
            </label>
            <div className="flex gap-2">
              {user.stock_view_store && (
                <button
                  onClick={() => setSelectedView('store')}
                  className={`px-4 py-1.5 rounded text-xs transition-colors ${
                    selectedView === 'store'
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Store
                </button>
              )}
              {user.stock_view_pca && (
                <button
                  onClick={() => setSelectedView('pca')}
                  className={`px-4 py-1.5 rounded text-xs transition-colors ${
                    selectedView === 'pca'
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  PCA
                </button>
              )}
              {user.stock_view_master && (
                <button
                  onClick={() => setSelectedView('master')}
                  className={`px-4 py-1.5 rounded text-xs transition-colors ${
                    selectedView === 'master'
                      ? 'bg-primary text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  Master
                </button>
              )}
            </div>
          </div>

          {/* Filters */}
          <div className="bg-white rounded-lg shadow p-4 mb-4">
            <div className="grid grid-cols-6 gap-3 mb-3">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Category
                </label>
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center"
                >
                  <span className="text-gray-500">
                    {categoryFilter.length === 0 ? "All" : `${categoryFilter.length} selected`}
                  </span>
                  <span className="text-gray-400">▼</span>
                </button>
                {showCategoryDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                    {categories.map((category) => (
                      <label key={category} className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={categoryFilter.includes(category)}
                          onChange={() => toggleCategory(category)}
                          className="mr-2"
                        />
                        {category}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Grade
                </label>
                <button
                  onClick={() => setShowGradeDropdown(!showGradeDropdown)}
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center"
                >
                  <span className="text-gray-500">
                    {gradeFilter.length === 0 ? "All" : `${gradeFilter.length} selected`}
                  </span>
                  <span className="text-gray-400">▼</span>
                </button>
                {showGradeDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                    {grades.map((grade) => (
                      <label key={grade} className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={gradeFilter.includes(grade)}
                          onChange={() => toggleGrade(grade)}
                          className="mr-2"
                        />
                        {grade}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {selectedView === 'store' && (
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Warehouse
                  </label>
                  <button
                    onClick={() => setShowWarehouseDropdown(!showWarehouseDropdown)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs bg-white text-left flex justify-between items-center"
                  >
                    <span className="text-gray-500">
                      {warehouseFilter.length === 0 ? "All" : `${warehouseFilter.length} selected`}
                    </span>
                    <span className="text-gray-400">▼</span>
                  </button>
                  {showWarehouseDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-y-auto">
                      {warehouses.map((warehouse) => (
                        <label key={warehouse} className="flex items-center text-xs px-3 py-2 cursor-pointer hover:bg-gray-50">
                          <input
                            type="checkbox"
                            checked={warehouseFilter.includes(warehouse)}
                            onChange={() => toggleWarehouse(warehouse)}
                            className="mr-2"
                          />
                          {warehouse}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {user.stock_view_hpj && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Max HPJ
                  </label>
                  <input
                    type="text"
                    value={hpjFilter}
                    onChange={(e) => setHpjFilter(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Filter by max HPJ"
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              <div className={selectedView === 'store' ? 'col-span-2' : 'col-span-3'}>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by SKU or Product Name..."
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={resetFilters}
                className="px-4 py-1.5 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">Loading...</div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="px-2 py-2 text-left font-semibold text-gray-700">Image</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-700">SKU</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-700">Product Name</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-700">Category</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-700">Grade</th>
                        {selectedView !== 'master' && (
                          <th className="px-2 py-2 text-left font-semibold text-gray-700">Stock</th>
                        )}
                        {selectedView === 'store' && (
                          <th className="px-2 py-2 text-left font-semibold text-gray-700">Warehouse</th>
                        )}
                        {user.stock_view_hpp && (
                          <th className="px-2 py-2 text-left font-semibold text-gray-700">HPP</th>
                        )}
                        {user.stock_view_hpt && (
                          <th className="px-2 py-2 text-left font-semibold text-gray-700">HPT</th>
                        )}
                        {user.stock_view_hpj && (
                          <th className="px-2 py-2 text-left font-semibold text-gray-700">HPJ</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-gray-50">
                          <td className="px-2 py-2">
                            {(item.link_url || item.image_url) ? (
                              <img 
                                src={item.link_url || item.image_url} 
                                alt={item.sku}
                                className="w-10 h-10 object-cover rounded"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect fill="%23ddd" width="40" height="40"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3ENo Img%3C/text%3E%3C/svg%3E';
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-[8px]">
                                No Img
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-2">{item.sku}</td>
                          <td className="px-2 py-2">{toProperCase(item.item_name)}</td>
                          <td className="px-2 py-2">{toProperCase(item.category)}</td>
                          <td className="px-2 py-2">{toProperCase(item.grade)}</td>
                          {selectedView !== 'master' && (
                            <td className="px-2 py-2">{item.stock}</td>
                          )}
                          {selectedView === 'store' && (
                            <td className="px-2 py-2">{item.warehouse}</td>
                          )}
                          {user.stock_view_hpp && (
                            <td className="px-2 py-2">{item.hpp}</td>
                          )}
                          {user.stock_view_hpt && (
                            <td className="px-2 py-2">{item.hpt}</td>
                          )}
                          {user.stock_view_hpj && (
                            <td className="px-2 py-2">{item.hpj}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredData.length === 0 && (
                    <div className="p-8 text-center text-gray-500">No data available</div>
                  )}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t">
                    <div className="text-xs text-gray-600">
                      Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Previous
                      </button>
                      {[...Array(totalPages)].map((_, i) => {
                        const page = i + 1;
                        if (
                          page === 1 ||
                          page === totalPages ||
                          (page >= currentPage - 1 && page <= currentPage + 1)
                        ) {
                          return (
                            <button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`px-3 py-1 text-xs border rounded ${
                                currentPage === page
                                  ? "bg-primary text-white"
                                  : "hover:bg-gray-50"
                              }`}
                            >
                              {page}
                            </button>
                          );
                        } else if (page === currentPage - 2 || page === currentPage + 2) {
                          return <span key={page} className="px-2">...</span>;
                        }
                        return null;
                      })}
                      <button
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 text-xs border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
            <h2 className="text-lg font-bold text-primary mb-4">Import Stock Data</h2>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Upload files for ERP Stock Balance and/or Javelin.
              </p>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ERP Stock Balance
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setErpFile(e.target.files?.[0] || null)}
                  disabled={importing}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90 disabled:opacity-50"
                />
                {erpFile && (
                  <p className="text-xs text-green-600 mt-2">
                    ✓ Selected: {erpFile.name}
                  </p>
                )}
              </div>

              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Javelin
                </label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={(e) => setJavelinFile(e.target.files?.[0] || null)}
                  disabled={importing}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-primary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-primary file:text-white hover:file:bg-primary/90 disabled:opacity-50"
                />
                {javelinFile && (
                  <p className="text-xs text-green-600 mt-2">
                    ✓ Selected: {javelinFile.name}
                  </p>
                )}
              </div>

              {importing && (
                <div className="text-sm text-gray-600 text-center py-3">
                  <div className="animate-pulse">Importing files... Please wait.</div>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setErpFile(null);
                  setJavelinFile(null);
                }}
                disabled={importing}
                className="flex-1 px-4 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || (!erpFile && !javelinFile)}
                className="flex-1 px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90 disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import Selected Files"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Popup 
        show={showPopup}
        message={popupMessage}
        type={popupType}
        onClose={() => setShowPopup(false)}
      />
    </div>
  );
}