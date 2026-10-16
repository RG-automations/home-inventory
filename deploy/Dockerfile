# Serwer statyczny dla zbudowanej aplikacji webowej (folder dist/).
# Build robimy na Windowsie (npx expo export), tu tylko serwujemy gotowe pliki —
# dzieki temu serwer nie musi miec Node.js ani budowac projektu.
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/

EXPOSE 80
