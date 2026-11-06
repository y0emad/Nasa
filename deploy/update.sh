#!/bin/sh
# Runs on the server every 2 minutes (cron). If Docker Hub has a newer image than the
# running one, it restarts the container on it. CI pushes a new image on every merge to main.
#
# One-time setup on the server:
#   curl -fsSL https://raw.githubusercontent.com/y0emad/Nasa/main/deploy/update.sh -o ~/nasa-update.sh
#   chmod +x ~/nasa-update.sh
#   (crontab -l 2>/dev/null; echo "*/2 * * * * $HOME/nasa-update.sh >> $HOME/nasa-deploy.log 2>&1") | crontab -
set -eu

IMAGE="${IMAGE:-yousefemad/nasa:latest}"
NAME="nasa"
NETWORK="clinicflow"
ENV_FILE="$HOME/nasa.env"

running=$(docker inspect -f '{{.Image}}' "$NAME" 2>/dev/null || true)
docker pull -q "$IMAGE" >/dev/null
latest=$(docker image inspect -f '{{.Id}}' "$IMAGE")

if [ "$running" = "$latest" ]; then
  exit 0
fi

echo "$(date -Is) new image $latest, restarting $NAME"
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped --network "$NETWORK" --env-file "$ENV_FILE" "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if docker exec "$NAME" node -e "fetch('http://localhost:8000/planets/get').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" 2>/dev/null; then
    echo "$(date -Is) deployed, healthy"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 2
done

echo "$(date -Is) WARNING: $NAME is not healthy, check: docker logs $NAME"
exit 1
