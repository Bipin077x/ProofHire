"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, ShieldAlert, ArrowRight, ShieldCheck, Database, RefreshCw, Upload, Image as ImageIcon, Type, Link as LinkIcon, X } from "lucide-react";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { PrivacyNote } from "../components/PrivacyNote";
import { HudRing } from "../components/HudRing";
import { HudPanel } from "../components/HudPanel";
import { copy } from "../content/copy";
import { demoData } from "./demo/data";
import { StatusBadge } from "../components/StatusBadge";

type Tab = "screenshot" | "text" | "link";

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>("screenshot");
  
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  
  const [analyzing, setAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Retry-after countdown
  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const isValid = () => {
    if (activeTab === "screenshot") return !!file;
    if (activeTab === "text") return text.trim().length > 0;
    if (activeTab === "link") return url.trim().length > 0 && url.includes("http");
    return false;
  };

  const handleFile = (f: File) => {
    setErrorMsg(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      setErrorMsg("Unsupported file type. Please upload a PNG, JPEG, or WEBP image.");
      return;
    }
    if (f.size > 5 * 1024 * 1024) {
      setErrorMsg("File too large. Maximum size is 5MB.");
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (activeTab !== "screenshot") return;
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const f = items[i].getAsFile();
        if (f) handleFile(f);
        break;
      }
    }
  };

  const fillExample = (type: "scam" | "clean" | "unknown") => {
    const d = demoData[type];
    setActiveTab("text");
    setText(d.redactedTranscript || "");
  };

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isValid()) return;
    
    setAnalyzing(true);
    setErrorMsg(null);
    abortControllerRef.current = new AbortController();

    try {
      let res;
      if (activeTab === "screenshot" && file) {
        const formData = new FormData();
        formData.append("image", file);
        res = await fetch("/api/analyze", {
          method: "POST",
          body: formData,
          signal: abortControllerRef.current.signal
        });
      } else {
        const body = activeTab === "text" ? { text } : { url };
        res = await fetch("/api/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortControllerRef.current.signal
        });
      }

      const data = await res.json().catch(() => ({ error: "Network error" }));
      
      if (!res.ok) {
        if (res.status === 429 && res.headers.has("Retry-After")) {
          setCountdown(parseInt(res.headers.get("Retry-After") || "60"));
        }
        let errStr = "Error analyzing input";
        if (typeof data.error === "string") errStr = data.error;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        else if (Array.isArray(data.error)) errStr = data.error.map((i: any) => i.message || "Invalid").join(", ");
        throw new Error(errStr);
      }
      
      try {
        const pRes = await fetch(`/api/passport/${data.passportId}`);
        if (pRes.ok) {
          const pData = await pRes.json();
          let cName = "";
          let rName = "";
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (pData.claims || []).forEach((c: any) => {
            if (c.key === "company" && c.status === "VERIFIED") cName = c.evidence;
            if (c.key === "role" && c.status === "VERIFIED") rName = c.evidence;
          });
          const historyTitle = (cName || rName) ? `${cName} ${rName}`.trim() : "Untitled post";
          
          const history = JSON.parse(localStorage.getItem("proofhire-history") || "[]");
          history.unshift({ 
            id: data.passportId, 
            date: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            verdict: pData.verdict,
            title: historyTitle
          });
          localStorage.setItem("proofhire-history", JSON.stringify(history.slice(0, 50)));
        }
      } catch(e) {}
      
      router.push(`/passport/${data.passportId}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      if (err.name === "AbortError") {
        setAnalyzing(false);
        return;
      }
      console.error(err);
      setErrorMsg(err.message || "Failed to analyze. Please try again.");
      setAnalyzing(false);
    }
  };

  const cancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const sampleScan = demoData["scam"];

  return (
    <div className="flex flex-col min-h-screen relative overflow-hidden bg-transparent" onPaste={handlePaste}>
      {/* Background Image */}
      <div 
        className="absolute inset-0 z-[-2]"
        style={{
          backgroundImage: "url('/bg.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          backgroundAttachment: "fixed"
        }}
      />
      {/* Readability Overlay */}
      <div 
        className="absolute inset-0 z-[-1]"
        style={{
          background: "linear-gradient(90deg, rgba(2, 8, 18, 0.95) 0%, rgba(2, 8, 18, 0.8) 50%, rgba(2, 8, 18, 0.95) 100%)"
        }}
      />
      
      <Header />
      
      <div className="absolute top-[20%] left-[50%] -translate-x-1/2 w-[800px] h-[400px] bg-[var(--hud-primary)]/5 blur-[120px] pointer-events-none rounded-full" />

      <main className="flex-1 w-full mx-auto px-4 py-12 relative z-10">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          
          {/* Left Column: Hero & Analyzer */}
          <div className="flex flex-col">
            <div className="mb-8">
              <h1 className="text-4xl md:text-5xl font-heading font-bold mb-4 tracking-tight uppercase text-transparent bg-clip-text bg-gradient-to-r from-white to-[var(--hud-primary)]">
                {copy.hero.headline}
              </h1>
              <p className="text-lg font-mono text-[var(--text)]/80 leading-[1.6] max-w-[70ch]">
                {copy.hero.subtitle}
              </p>
            </div>

            <HudPanel className="w-full mb-6">
              {analyzing ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <HudRing size={80} className="mb-6" />
                  <h3 className="text-xl font-heading uppercase text-[var(--hud-primary)] mb-2 animate-pulse">Running Checks...</h3>
                  <p className="text-sm font-mono text-[var(--muted)] mb-8">Consulting DNS, official pages, and community reports</p>
                  <button 
                    onClick={cancelAnalysis}
                    className="px-4 py-2 border border-[var(--status-risk)] text-[var(--status-risk)] rounded hover:bg-[var(--status-risk)]/10 font-mono text-sm uppercase transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAnalyze}>
                  {errorMsg && (
                    <div className="mb-4 p-3 border border-[var(--status-risk)] bg-black/40 rounded text-[var(--status-risk)] text-sm font-mono flex items-start gap-2">
                      <ShieldAlert className="w-5 h-5 shrink-0" />
                      <div>
                        <p>{errorMsg}</p>
                        {countdown !== null && countdown > 0 && <p className="mt-1">Retry after: {countdown}s</p>}
                      </div>
                    </div>
                  )}

                  <div className="flex border-b border-[var(--border)] mb-4">
                    <button type="button" onClick={() => setActiveTab("screenshot")} className={`flex-1 py-2 text-sm font-mono uppercase transition-colors ${activeTab === "screenshot" ? "text-[var(--hud-primary)] border-b-2 border-[var(--hud-primary)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}><ImageIcon className="w-4 h-4 inline mr-1"/> Screenshot</button>
                    <button type="button" onClick={() => setActiveTab("text")} className={`flex-1 py-2 text-sm font-mono uppercase transition-colors ${activeTab === "text" ? "text-[var(--hud-primary)] border-b-2 border-[var(--hud-primary)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}><Type className="w-4 h-4 inline mr-1"/> Text</button>
                    <button type="button" onClick={() => setActiveTab("link")} className={`flex-1 py-2 text-sm font-mono uppercase transition-colors ${activeTab === "link" ? "text-[var(--hud-primary)] border-b-2 border-[var(--hud-primary)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}><LinkIcon className="w-4 h-4 inline mr-1"/> Link</button>
                  </div>

                  <div className="mb-4">
                    {activeTab === "screenshot" && (
                      <div 
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        className="w-full h-40 bg-black/50 border-2 border-dashed border-[var(--border)] rounded-md p-4 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--hud-primary)] transition-colors relative"
                        onClick={() => !preview && fileInputRef.current?.click()}
                      >
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                        {preview ? (
                          <div className="relative w-full h-full flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={preview} alt="Preview" className="max-h-full max-w-full object-contain" />
                            <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }} className="absolute top-0 right-0 bg-black/80 text-white p-1 rounded hover:text-[var(--status-risk)] border border-[var(--border)]">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <Upload className="w-8 h-8 text-[var(--muted)] mb-2" />
                            <p className="text-sm font-mono text-[var(--text)]">Drag & drop or paste image</p>
                            <p className="text-xs font-mono text-[var(--muted)] mt-1">PNG, JPEG, WEBP (Max 5MB)</p>
                          </>
                        )}
                      </div>
                    )}

                    {activeTab === "text" && (
                      <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        placeholder="Paste the suspicious text here..."
                        className="w-full h-40 bg-black/50 border border-[var(--border)] rounded-md p-4 font-mono text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--hud-primary)] resize-none"
                      />
                    )}

                    {activeTab === "link" && (
                      <div>
                        <input
                          type="url"
                          value={url}
                          onChange={e => setUrl(e.target.value)}
                          placeholder="https://example.com/job"
                          className="w-full bg-black/50 border border-[var(--border)] rounded-md p-3 font-mono text-sm text-[var(--text)] focus:outline-none focus:ring-2 focus:ring-[var(--hud-primary)] mb-2"
                        />
                        <p className="text-xs font-mono text-[var(--muted)]">
                          {copy.tabs.linkNote}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  <PrivacyNote />
                  
                  <div className="mt-6">
                    <button
                      type="submit"
                      disabled={!isValid() || (countdown !== null && countdown > 0)}
                      className="w-full bg-[var(--hud-primary)]/20 hover:bg-[var(--hud-primary)]/30 border border-[var(--hud-primary)] text-[var(--hud-primary)] font-heading uppercase tracking-widest py-4 rounded-md transition-all flex items-center justify-center gap-2 group focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black focus:ring-[var(--hud-primary)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                      Analyze Now
                    </button>
                  </div>
                </form>
              )}
            </HudPanel>

            {!analyzing && (
              <div className="mb-6">
                <p className="text-sm font-mono uppercase text-[var(--gold-accent)] mb-3">Try an example</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => fillExample("scam")} className="px-3 py-1 border border-[var(--border)] rounded text-xs font-mono uppercase text-[var(--text)] hover:border-[var(--hud-primary)] bg-black/40">Scam</button>
                  <button onClick={() => fillExample("clean")} className="px-3 py-1 border border-[var(--border)] rounded text-xs font-mono uppercase text-[var(--text)] hover:border-[var(--hud-primary)] bg-black/40">Clean</button>
                  <button onClick={() => fillExample("unknown")} className="px-3 py-1 border border-[var(--border)] rounded text-xs font-mono uppercase text-[var(--text)] hover:border-[var(--hud-primary)] bg-black/40">Unknown</button>
                </div>
              </div>
            )}

            <div className="flex gap-6 mt-4">
              {copy.trust.map((t, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[var(--muted)] text-xs font-mono uppercase">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--hud-primary)]" />
                  {t}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Static Mini Passport */}
          <div className="hidden lg:block">
            <div className="relative border border-[var(--border)] rounded bg-black/40 p-6 shadow-[0_0_15px_var(--hud-glow)]">
              <div className="absolute -top-3 left-4 bg-[var(--bg)] px-2 text-xs font-heading text-[var(--hud-primary)] uppercase tracking-wider">Sample Passport</div>
              
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="font-heading text-2xl uppercase text-[var(--text)]">{sampleScan.id}</h3>
                  <p className="font-mono text-xs text-[var(--muted)] mt-1">{new Date(sampleScan.createdAt).toLocaleString()}</p>
                </div>
                <StatusBadge status={sampleScan.verdict as any} />
              </div>
              
              <div className="space-y-3 mb-6">
                {sampleScan.claims.slice(0, 3).map((claim: any, idx: number) => (
                  <div key={idx} className="p-3 bg-black/60 border border-[var(--border)] rounded flex gap-3 items-start">
                    <div className="mt-0.5"><StatusBadge status={claim.status as any} /></div>
                    <div>
                      <p className="font-mono text-sm uppercase text-[var(--text)]">{claim.key}</p>
                      <p className="font-mono text-xs text-[var(--muted)] mt-1">{claim.evidence}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center pt-4 border-t border-[var(--border)]">
                <Link href="/demo/scam" className="text-xs font-mono uppercase text-[var(--hud-primary)] hover:text-[var(--gold-accent)] transition-colors inline-flex items-center gap-1">
                  View full sample passport <ArrowRight className="w-3 h-3" />
                </Link>
                <Link href="/demo/clean" className="text-xs font-mono uppercase text-[var(--muted)] hover:text-[var(--text)] transition-colors">
                  Clean example
                </Link>
                <Link href="/demo/unknown" className="text-xs font-mono uppercase text-[var(--muted)] hover:text-[var(--text)] transition-colors">
                  Unknown example
                </Link>
              </div>
            </div>
          </div>
          
        </div>
      </main>
      <Footer />
    </div>
  );
}
