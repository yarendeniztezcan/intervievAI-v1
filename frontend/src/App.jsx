import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SimulationSetup from './pages/SimulationSetup';
import Simulation from './pages/Simulation';
import Results from './pages/Results';
import Profile from './pages/Profile';
import RedoQuestions from './pages/RedoQuestions';
import { isAuthenticated } from './utils/auth';
import './styles/index.css';

// Giriş yapmamış kullanıcıları giriş sayfasına yönlendirir.
const RequireAuth = ({ children }) => (isAuthenticated() ? children : <Navigate to="/login" replace />);

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="container mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/setup" element={<RequireAuth><SimulationSetup /></RequireAuth>} />
            <Route path="/simulation" element={<RequireAuth><Simulation /></RequireAuth>} />
            <Route path="/results" element={<RequireAuth><Results /></RequireAuth>} />
            <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
            <Route path="/redo" element={<RequireAuth><RedoQuestions /></RequireAuth>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
