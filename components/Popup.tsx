"use client";

interface PopupProps {
  show: boolean;
  message: string;
  type: "success" | "error";
  onClose: () => void;
}

export default function Popup({ show, message, type, onClose }: PopupProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className={`text-center mb-4 ${type === "success" ? "text-green-600" : "text-red-600"}`}>
          <div className="text-4xl mb-2">
            {type === "success" ? "✓" : "✕"}
          </div>
          <h3 className="text-lg font-bold">
            {type === "success" ? "Success" : "Error"}
          </h3>
        </div>
        <p className="text-sm text-gray-700 whitespace-pre-line mb-6 text-center">
          {message}
        </p>
        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-primary text-white rounded text-sm hover:bg-primary/90"
        >
          OK
        </button>
      </div>
    </div>
  );
}