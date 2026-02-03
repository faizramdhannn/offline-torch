"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar";

interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  method: string;
  activity_log: string;
}

interface StoreAddress {
  id: string;
  store_location: string;
  phone_number: string;
  address: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [storeAddresses, setStoreAddresses] = useState<StoreAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const itemsPerPage = 10;

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (!userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    if (!parsedUser.dashboard) {
      router.push("/login");
      return;
    }
    setUser(parsedUser);
    fetchActivityLogs();
    fetchStoreAddresses();
  }, []);

  const fetchActivityLogs = async () => {
    try {
      const response = await fetch("/api/activity-log");
      if (response.ok) {
        const data = await response.json();
        setActivityLogs(data);
      }
    } catch (error) {
      console.error("Failed to fetch activity logs:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStoreAddresses = async () => {
    try {
      const response = await fetch("/api/store-address");
      if (response.ok) {
        const data = await response.json();
        setStoreAddresses(data);
      }
    } catch (error) {
      console.error("Failed to fetch store addresses:", error);
    }
  };

  const handleCopy = (store: StoreAddress) => {
    const text = `${store.store_location}\n${store.phone_number} ${store.address}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(store.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = activityLogs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(activityLogs.length / itemsPerPage);

  if (!user) return null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar userName={user.name} permissions={user} />

      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-primary mb-6">Dashboard</h1>

          {/* Stats Section - Placeholder */}
          <div className="grid grid-cols-7 gap-1 mb-6">
            {["Store 1", "Store 2", "Store 3", "Store 4", "Store 5", "Store 6", "Store 7"].map((label) => (
              <div key={label} className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-600 mb-1">{label}</div>
                <div className="text-2xl font-bold text-gray-800">-</div>
                <div className="text-xs text-gray-500 mt-1">Coming soon</div>
              </div>
            ))}
          </div>

          {/* Store Location Section */}
          <div className="bg-white rounded-lg shadow mb-6">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">
                Store Location
              </h3>
            </div>

            {storeAddresses.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No store data available
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Store</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600">Address</th>
                      <th className="px-3 py-2 text-left font-medium text-gray-600 w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {storeAddresses.map((store, index) => (
                      <tr
                        key={store.id}
                        className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
                      >
                        <td className="px-3 py-1.5 text-gray-700 font-medium">{store.store_location}</td>
                        <td className="px-3 py-1.5 text-gray-600">{store.phone_number} {store.address}</td>
                        <td className="px-3 py-1.5">
                          <button
                            onClick={() => handleCopy(store)}
                            className="text-gray-400 hover:text-primary transition-colors"
                            title="Copy"
                          >
                            {copiedId === store.id ? (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            ) : (
                              <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                              </svg>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity Log Section */}
          <div className="bg-white rounded-lg shadow">
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-800">
                Activity Log
              </h3>
            </div>

            {loading ? (
              <div className="p-6 text-center text-sm text-gray-500">
                Loading...
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">
                No activity logs yet
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 w-36">
                          Timestamp
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 w-24">
                          User
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600 w-20">
                          Method
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-600">
                          Activity
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentItems.map((log, index) => (
                        <tr
                          key={log.id}
                          className={`border-b ${index % 2 === 0 ? "bg-white" : "bg-gray-50"} hover:bg-gray-100`}
                        >
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                            {log.timestamp}
                          </td>
                          <td className="px-3 py-2 text-gray-700 font-medium">
                            {log.user}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs font-medium ${
                                log.method === "POST"
                                  ? "bg-green-100 text-green-800"
                                  : log.method === "PUT"
                                    ? "bg-blue-100 text-blue-800"
                                    : log.method === "DELETE"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {log.method}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-gray-600">
                            {log.activity_log}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-between items-center px-4 py-3 border-t">
                    <div className="text-xs text-gray-600">
                      Showing {indexOfFirstItem + 1} to{" "}
                      {Math.min(indexOfLastItem, activityLogs.length)} of{" "}
                      {activityLogs.length} logs
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
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
                        } else if (
                          page === currentPage - 2 ||
                          page === currentPage + 2
                        ) {
                          return (
                            <span key={page} className="px-2 text-xs">
                              ...
                            </span>
                          );
                        }
                        return null;
                      })}
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
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
    </div>
  );
}