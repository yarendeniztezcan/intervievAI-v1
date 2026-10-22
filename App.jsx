import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import SimulationSetup from './pages/SimulationSetup';
import CodingSimulation from './pages/CodingSimulation';
import VerbalSimulation from './pages/VerbalSimulation';
import MixedSimulation from './pages/MixedSimulation';
import Results from './pages/Results';
import Profile from './pages/Profile';
import RedoQuestions from './pages/RedoQuestions';
import './styles/index.css';

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
            <Route path="/setup" element={<SimulationSetup />} />
            <Route path="/coding" element={<CodingSimulation />} />
            <Route path="/verbal" element={<VerbalSimulation />} />
            <Route path="/mixed" element={<MixedSimulation />} />
            <Route path="/results" element={<Results />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/redo" element={<RedoQuestions />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;