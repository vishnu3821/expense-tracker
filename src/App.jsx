import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard'
import Auth from './pages/Auth'
import AddExpense from './pages/AddExpense'
import History from './pages/History'
import Profile from './pages/Profile'
import More from './pages/More'
import YearBreakdown from './pages/YearBreakdown'
import MonthDetail from './pages/MonthDetail'
import Savings from './pages/Savings'
import AdminDashboard from './pages/AdminDashboard'
import { Analytics } from '@vercel/analytics/react'

function PrivateRoute({ children }) {
  const { user } = useAuth()
  return user ? children : <Navigate to="/auth" />
}

function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
              <Route index element={<Dashboard />} />
              <Route path="add" element={<AddExpense />} />
              <Route path="history" element={<History />} />
              <Route path="profile" element={<Profile />} />
              <Route path="more" element={<More />} />
              <Route path="more/year" element={<YearBreakdown />} />
              <Route path="more/year/:year/:month" element={<MonthDetail />} />
              <Route path="more/savings" element={<Savings />} />
              <Route path="more/admin-breakdown" element={<AdminDashboard />} />
            </Route>
          </Routes>
        </Router>
        <Analytics />
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App
