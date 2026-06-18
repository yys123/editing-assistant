# 本机蓝绿发布

这个项目目前运行在你的 Mac 上，其他人通过局域网访问你的 Mac。不要使用远程发布脚本 `deploy-bluegreen.sh`，它是给云服务器 SSH 场景准备的。

本机场景使用：

```bash
./deploy-local-bluegreen.sh all
```

同事固定访问：

```text
http://你的Mac局域网IP:5175
```

脚本会在本机启动一个稳定入口：

- `5175`：本地 Node 代理，负责服务前端页面并转发 `/api`
- `8101`：blue 后端槽位
- `8102`：green 后端槽位

发布后端时，脚本会启动空闲槽位，确认 `/healthz` 正常，再把代理切到新槽位，等待默认 20 秒后停止旧槽位。

## 第一次启动

```bash
./deploy-local-bluegreen.sh all
```

启动后查看状态：

```bash
./deploy-local-bluegreen.sh status
```

把状态里显示的 `LAN` 地址发给同事。

## 日常发布

只改后端：

```bash
./deploy-local-bluegreen.sh backend
```

只改前端：

```bash
./deploy-local-bluegreen.sh frontend
```

前后端都改：

```bash
./deploy-local-bluegreen.sh all
```

延长旧后端保留时间：

```bash
DRAIN_SECONDS=60 ./deploy-local-bluegreen.sh backend
```

## 停止服务

```bash
./deploy-local-bluegreen.sh stop
```

## 和开发脚本的区别

`start.sh` 是开发用的，会停止 `8002` 和 `5175`，并用 Vite dev server 与 `uvicorn --reload`。有人正在使用时不要运行 `start.sh`。

本机蓝绿发布使用生产构建的 `frontend/dist`，后端不使用 `--reload`，并通过 `5175` 作为固定访问入口。

## 注意事项

- 发布前确认数据库变更兼容，不要在同一次发布里直接删除旧字段。
- 当前 UTD 定时任务在后端进程内运行，蓝绿切换期间新旧后端会短暂共存，尽量避开每天 `02:00` 附近发布。
- 如果 `5175`、`8101` 或 `8102` 被其他程序占用，脚本会停止并提示占用进程。
