import { useEffect, useRef, useState } from "react";
import { Controller } from "@mercuryworkshop/scramjet-controller";
import { defaultConfig } from "@mercuryworkshop/scramjet";
import EpoxyTransport from "@mercuryworkshop/epoxy-transport";

function App() {
  const scramjetRef = useRef<Controller | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [url, setUrl] = useState("https://example.com");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      const registration = await navigator.serviceWorker.ready;
      const serviceworker =
        navigator.serviceWorker.controller ?? registration.active!;

      const transport = new EpoxyTransport({
        wisp: "wss://domain.tld/wisp/",
      });
      await transport.init();

      const scramjet = new Controller({
        serviceworker,
        transport,
        scramjetConfig: defaultConfig,
      });

      await scramjet.wait();

      if (isMounted && iframeRef.current) {
        scramjetRef.current = scramjet;
        const frame = scramjet.createFrame(iframeRef.current);
        frame.go(url);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const navigate = (newUrl: string) => {
    setUrl(newUrl);
    setLoading(true);
    const frame = scramjetRef.current?.getFrames()[0];
    if (frame) {
      frame.go(newUrl);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ padding: "8px", display: "flex", gap: "8px" }}>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate(url)}
          style={{ flex: 1, padding: "8px" }}
        />
        <button onClick={() => navigate(url)}>Go</button>
        {loading && <span>Loading...</span>}
      </div>
      <iframe
        ref={iframeRef}
        title="browser"
        style={{ flex: 1, border: "none", width: "100%" }}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}

export default App;
