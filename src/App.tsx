import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage from './pages/LoginPage'
import PcToolVersionPage from './pages/PcToolVersionPage'
import PcToolVersionListPage from './pages/PcToolVersionListPage'
import {getFullPath}  from './config/constants';

// 私有路由组件
const PrivateRoute = ({ children }: { children: React.ReactNode }) => {
  const token = sessionStorage.getItem('token')
  
  return token ? (
    <>{children}</>
  ) : (
    <Navigate to={getFullPath('login')} replace />
  )
}

function App() {
  const token = sessionStorage.getItem('token');
  return (
    <Router>
      <Routes>
        <Route path={getFullPath('login')} element={<LoginPage />} />
        <Route 
          path={getFullPath('pc-tools')} 
          element={
            <PrivateRoute>
                <PcToolVersionListPage />
              </PrivateRoute>
          } 
        />
        <Route 
          path={getFullPath('pc-tools/new')} 
          element={
            <PrivateRoute>
              <PcToolVersionPage />
            </PrivateRoute>
          } 
        />
        <Route
          path={getFullPath('')}
          element={<Navigate to={token ? getFullPath('pc-tools') : getFullPath('login')} replace />}
        />
        <Route path="*" element={<Navigate to={token ? getFullPath('pc-tools') : getFullPath('login')} replace />} />
      </Routes>
    </Router>
  )
}

export default App