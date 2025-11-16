import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { DirectMessageProvider } from './contexts/DirectMessageContext'
import Login from './pages/Login'
import Bygder from './pages/Bygder'
import BygdFeed from './pages/BygdFeed'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/" />
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <DirectMessageProvider>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route
              path="/bygder"
              element={
                <ProtectedRoute>
                  <Bygder />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bygd/:bygdId"
              element={
                <ProtectedRoute>
                  <BygdFeed />
                </ProtectedRoute>
              }
            />
          </Routes>
        </DirectMessageProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
