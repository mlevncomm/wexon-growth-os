"use client";

import dynamic from "next/dynamic";

// Ses, mikrofon ve ses tanıma sadece tarayıcıda çalışır
const Ui = dynamic(() => import("./ui"), {
  ssr: false,
  loading: () => <p className="page-copy">Arama ekranı yükleniyor…</p>,
});

export default function Page() {
  return <Ui />;
}
