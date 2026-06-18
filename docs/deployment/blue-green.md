# Blue-Green Deployment

这个项目本地开发仍然使用 `./start.sh`。线上有人使用时，不要用 `start.sh`，也不要用旧的 `deploy.sh`，因为它会停止现有后端。

线上发布使用：

```bash
./deploy-bluegreen.sh root@8.222.87.126 backend
```

## 第一次上线

第一次使用蓝绿部署时，建议发布完整应用：

```bash
./deploy-bluegreen.sh root@8.222.87.126 all
```

如果这里报 `Permission denied (publickey)`，说明当前 Mac 没有被服务器 SSH 授权。先执行：

```bash
ssh root@8.222.87.126 'echo ok'
```

这个命令必须成功，才能继续部署。若失败，需要把本机 `~/.ssh/*.pub` 里的公钥加入服务器 `/root/.ssh/authorized_keys`，或改用服务器实际允许登录的用户：

```bash
./deploy-bluegreen.sh <user>@8.222.87.126 all
```

脚本会：

1. 同步代码到 `/opt/editing-assistant`。
2. 构建前端镜像。
3. 构建空闲后端槽位镜像。
4. 启动空闲后端槽位。
5. 检查 `http://127.0.0.1:8004/healthz`。
6. 启动或 reload 前端容器里的 Nginx，把 `/api` 切到新后端。
7. 等待默认 20 秒，再停止旧后端。

## 常用命令

只发后端：

```bash
./deploy-bluegreen.sh root@8.222.87.126 backend
```

只发前端：

```bash
./deploy-bluegreen.sh root@8.222.87.126 frontend
```

调整旧后端保留时间：

```bash
DRAIN_SECONDS=60 ./deploy-bluegreen.sh root@8.222.87.126 backend
```

查看当前活动槽位：

```bash
ssh root@8.222.87.126 'cat /opt/editing-assistant/deploy/runtime/active_backend_slot'
```

查看容器：

```bash
ssh root@8.222.87.126 'cd /opt/editing-assistant && docker compose -f docker-compose.bluegreen.yml ps'
```

## 回滚

如果新后端切过去后发现问题，重新切回另一个槽位：

```bash
ssh root@8.222.87.126 'cd /opt/editing-assistant && printf "%s\n" "upstream active_backend {" "    server backend-blue:8004;" "    keepalive 32;" "}" > deploy/runtime/nginx-backend-upstream.conf && docker compose -f docker-compose.bluegreen.yml up -d backend-blue frontend && docker compose -f docker-compose.bluegreen.yml exec -T frontend nginx -s reload && printf "%s\n" blue > deploy/runtime/active_backend_slot'
```

如果当前活动槽位是 `blue`，把上面命令里的 `blue` 改成 `green`。

## 注意事项

- 发布前确认数据库变更是兼容的。安全顺序是先加字段、先兼容旧逻辑，不要在同一次发布里删除旧字段。
- 蓝绿切换期间新旧后端会短时间同时存在。当前 UTD 定时任务在后端进程内运行，避免在每天 02:00 附近发布。
- 长期更稳的结构是把 UTD 定时任务拆成独立 worker，让 Web 后端只处理请求。
- `deploy.sh` 仍保留为旧 Docker 发布方式，但它会 `docker compose down`，线上有用户时不要使用。
