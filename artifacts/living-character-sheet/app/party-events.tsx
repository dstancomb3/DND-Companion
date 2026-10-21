import React from "react";
import { Redirect } from "expo-router";

export default function PartyEventsScreen() {
  return <Redirect href={{ pathname: "/party", params: { section: "events" } }} />;
}
