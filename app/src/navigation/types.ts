import { Station } from "../types/station";

export type RootStackParamList = {
  Tabs: undefined;
  StationDetail: { stationId: string; station?: Station };
  OnMyWay: undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
  Licenses: undefined;
};

export type TabParamList = {
  Map: undefined;
  Favorites: undefined;
  Alerts: undefined;
  Settings: undefined;
};
