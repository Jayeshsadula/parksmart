// src/context/BookingContext.jsx
import React, { createContext, useContext, useReducer } from "react";

const BookingContext = createContext(null);

const initialState = {
  selectedArea: null,
  selectedFloor: null,
  selectedSlot: null,
  bookingDate: new Date().toISOString().split("T")[0],
  startTime: "10:00",
  endTime: "12:00",
  confirmedBooking: null,
};

const reducer = (state, action) => {
  switch (action.type) {
    case "SET_AREA":       return { ...state, selectedArea: action.payload, selectedFloor: null, selectedSlot: null };
    case "SET_FLOOR":      return { ...state, selectedFloor: action.payload, selectedSlot: null };
    case "SET_SLOT":       return { ...state, selectedSlot: action.payload };
    case "SET_DATE":       return { ...state, bookingDate: action.payload };
    case "SET_START_TIME": return { ...state, startTime: action.payload };
    case "SET_END_TIME":   return { ...state, endTime: action.payload };
    case "SET_CONFIRMED":  return { ...state, confirmedBooking: action.payload };
    case "RESET":          return initialState;
    default: return state;
  }
};

export const BookingProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  return (
    <BookingContext.Provider value={{ ...state, dispatch }}>
      {children}
    </BookingContext.Provider>
  );
};

export const useBooking = () => useContext(BookingContext);
