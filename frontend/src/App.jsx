import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from './context/AuthContext';
import { KioskProvider } from './context/KioskContext';
import { CartProvider } from './context/CartContext';
import { QueueProvider } from './context/QueueContext';
import { ProductProvider } from './context/ProductContext';
import { SettingsProvider } from './context/SettingsContext';
import { OrderProvider } from './context/OrderContext';
import KioskMenu from './pages/KioskMenu/KioskMenu';
import SelfCheckout from './pages/SelfCheckout/SelfCheckout';
import Printing from './pages/PrintingService/PrintingService';
import SendFile from './pages/SendFile/SendFile';
import Staff from './pages/Staff/Staff';
import Admin from './pages/Admin/Admin';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './components/NotFound';
import RoleRoute from './components/RoleRoute';
export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <KioskProvider>
          <SettingsProvider>
            <ProductProvider>
              <CartProvider>
                <QueueProvider>
                  <OrderProvider>
                    <BrowserRouter>
                      <Routes>
                        <Route path="/" element={<KioskMenu />} />
                        <Route path="/checkout" element={<SelfCheckout />} />
                        <Route path="/printing" element={<Printing />} />
                        <Route path="/send/:code" element={<SendFile />} />
                        <Route element={<RoleRoute allowedRoles={["Staff"]} />}>
                          <Route path="/staff" element={<Staff />}/>
                        </Route>
                        <Route path="/admin/*" element={<Admin />} />          
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </BrowserRouter>
                    <ToastContainer position="top-center" autoClose={3000} limit={3} theme="colored" />
                  </OrderProvider>
                </QueueProvider>
              </CartProvider>
            </ProductProvider>
          </SettingsProvider>
        </KioskProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
