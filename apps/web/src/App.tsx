import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { TabLayout } from "./layouts/TabLayout";
import { AssetsScreen } from "./screens/AssetsScreen";
import { DemoScreen } from "./screens/DemoScreen";
import { FriendDetailScreen } from "./screens/FriendDetailScreen";
import { FriendsMarketScreen } from "./screens/FriendsMarketScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { NotificationsScreen } from "./screens/NotificationsScreen";
import { PromiseCreateScreen } from "./screens/PromiseCreateScreen";
import { PromiseDetailScreen } from "./screens/PromiseDetailScreen";
import { PromisesScreen } from "./screens/PromisesScreen";
import { SettlementResultPage } from "./screens/SettlementResultPage";
import { ShopScreen } from "./screens/ShopScreen";
import { SignupScreen } from "./screens/SignupScreen";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginScreen />} />
      <Route path="/signup" element={<SignupScreen />} />

      <Route element={<ProtectedRoute />}>
        <Route
          path="results/position/:positionId"
          element={<SettlementResultPage kind="investor" />}
        />
        <Route
          path="results/stock/:promiseId"
          element={<SettlementResultPage kind="stock" />}
        />

        <Route element={<TabLayout />}>
          <Route index element={<Navigate to="/home" replace />} />
          <Route path="home" element={<HomeScreen />} />
          <Route path="friends" element={<FriendsMarketScreen />} />
          <Route path="promises" element={<PromisesScreen />} />
          <Route path="assets" element={<AssetsScreen />} />
          <Route path="shop" element={<ShopScreen />} />
          <Route path="history" element={<HistoryScreen />} />
          <Route path="notifications" element={<NotificationsScreen />} />
          <Route path="demo" element={<DemoScreen />} />
        </Route>
        <Route path="friends/:userId" element={<FriendDetailScreen />} />
        <Route path="promises/new" element={<PromiseCreateScreen />} />
        <Route path="promises/:id" element={<PromiseDetailScreen />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
