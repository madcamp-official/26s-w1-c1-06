import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { TabLayout } from "./layouts/TabLayout";
import { AssetsScreen } from "./screens/AssetsScreen";
import { DemoScreen } from "./screens/DemoScreen";
import { FriendsMarketScreen } from "./screens/FriendsMarketScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { PromisesScreen } from "./screens/PromisesScreen";
import { SignupScreen } from "./screens/SignupScreen";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/signup" element={<SignupScreen />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<TabLayout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<HomeScreen />} />
          <Route path="friends" element={<FriendsMarketScreen />} />
          <Route path="promises" element={<PromisesScreen />} />
          <Route path="assets" element={<AssetsScreen />} />
          <Route path="demo" element={<DemoScreen />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
