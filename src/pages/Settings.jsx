import React from 'react';
import { openConsent } from '../components/consentBus';
import { useNavigate } from "react-router-dom";



export default function Settings({ onBack }) {
  const navigate = useNavigate();
  const hasConsented = !!localStorage.getItem('pp_consents');
  const stored = hasConsented ? JSON.parse(localStorage.getItem('pp_consents')) : null;
  
const handleBack = () => {
  if (onBack) onBack();
  else navigate("/", { replace: true });
};

  return (

    
    <div className="max-w-3xl mx-auto p-6">
      
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      <section className="glass p-4 rounded-xl mb-6">
        <h2 className="text-lg font-semibold">Cookies & Privacy</h2>
        <p className="text-slate-600 mt-2">
          Manage your cookie choices for Postcode Pursuit.
        </p>

        <div className="mt-4 flex gap-2">
          <button className="btn btn-primary" onClick={openConsent}>
            Manage cookies
          </button>
<button
  className="btn btn-purple"
  onClick={() => {
    if (onBack) {
      // use hash navigation inside game
      window.location.hash = "#/privacy";
    } else {
      navigate("/privacy");
    }
  }}
>
  Privacy Policy
</button>


<button onClick={handleBack} className="btn btn-primary">
  Return to Menu
</button><br />
      <a
        href="https://forms.gle/Hf6fgRzBSnnZCqYJ6"
        className="mt-3 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
      >
        Send feedback
      </a>
        </div>

        {stored && (
          <div className="mt-4 text-sm text-slate-600">
            <div><b>Last choice:</b> {new Date(stored.timestamp).toLocaleString()}</div>
            <div><b>Analytics:</b> {stored.choices?.analytics ? 'Allowed' : 'Rejected'}</div>
          </div>
          
        )}
      </section>
    </div>

  );
}