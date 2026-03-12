// Removed nested Router; routing now handled by top-level BrowserRouter in index.tsx
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Rooms from './pages/Rooms'
import RoomEditor from './pages/RoomEditor'
import Landing from './pages/Landing'

function App() {
  return (
    // Providers are now applied in index.tsx under BrowserRouter
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute />}>
        {/* Switched to Rooms page with logout and rooms dashboard */}
        <Route path="/rooms" element={<Rooms />} />
        {/* Added: Room editor route for joined rooms */}
        <Route path="/rooms/:roomId" element={<RoomEditor />} />
      </Route>
    </Routes>
  )
}

export default App


