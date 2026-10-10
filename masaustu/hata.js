// Bağlantı hatası sayfası: Growth OS'a tekrar bağlanmayı dener.
const q = new URLSearchParams(location.search);
const hedef = q.get("adres") || "https://wexon-growth-os.vercel.app/arama";
document.getElementById("ayrinti").textContent = (q.get("hata") || "") + " · " + hedef;
const git = () => { location.href = hedef; };
document.getElementById("tekrar").onclick = git;
window.addEventListener("online", git);
setInterval(() => { if (navigator.onLine) git(); }, 15000);
