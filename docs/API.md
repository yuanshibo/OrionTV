### 服务器配置

- **接口地址**: `/api/server-config`
- **请求方法**: `GET`
- **功能说明**: 获取服务器配置信息
- **请求参数**: 无
- **返回格式**:
  ```json
  {
    "SiteName": "string",
    "StorageType": "string"
  }
  ```
  StorageType 可选值：
- "localstorage"
- "redis"

localstorage 方式部署的实例，收藏、播放记录和搜索历史无服务器同步，客户端自行处理即可

localstorage 方式部署的实例，登录时只需输入密码，无用户名

### 登录校验

- **接口地址**: `/api/login`
- **请求方法**: `POST`
- **功能说明**: 用户登录认证
- **请求参数**:
  ```json
  {
    "password": "string", // 必填，用户密码
    "username": "string" // 选填，用户名（非 localStorage 模式时必填）
  }
  ```
- **返回格式**:
  ```json
  {
    "ok": true
  }
  ```
- **错误码**:
  - `400`: 参数错误或密码错误
  - `500`: 服务器内部错误

response 会设置 set-cookie 的 auth 字段，用于后续请求的鉴权

后续的所有接口请求时都需要携带 auth 字段，否则会返回 401 错误

建议客户端保存用户输入的用户名和密码，在每次 app 启动时请求登录接口获取 cookie

### 视频搜索接口

- **接口地址**: `/api/search`
- **请求方法**: `GET`
- **功能说明**: 搜索视频内容
- **请求参数**:
  - `q`: 搜索关键词（可选，不传返回空结果）
- **返回格式**:
  ```json
  {
    "results": [
      {
        "id": "string", // 视频在源站中的 id
        "title": "string", // 视频标题
        "poster": "string", // 视频封面
        "source": "string", // 视频源站 key
        "source_name": "string", // 视频源站名称
        "class": "string", // 视频分类
        "year": "string", // 视频年份
        "desc": "string", // 视频描述
        "type_name": "string", // 视频类型
        "douban_id": "string" // 视频豆瓣 id
      }
    ]
  }
  ```
- **错误码**:
  - `500`: 搜索失败

### 视频详情接口

- **接口地址**: `/api/detail`
- **请求方法**: `GET`
- **功能说明**: 获取视频详细信息
- **请求参数**:
  - `id`: 视频 ID（必填）
  - `source`: 视频来源代码（必填）
- **返回格式**:
  ```json
  {
    "id": "string", // 视频在源站中的 id
    "title": "string", // 视频标题
    "poster": "string", // 视频封面
    "source": "string", // 视频源站 key
    "source_name": "string", // 视频源站名称
    "class": "string", // 视频分类
    "year": "string", // 视频年份
    "desc": "string", // 视频描述
    "type_name": "string", // 视频类型
    "douban_id": "string" // 视频豆瓣 id
  }
  ```
- **错误码**:
  - `400`: 缺少必要参数或无效参数
  - `500`: 获取详情失败

### 豆瓣数据接口

- **接口地址**: `/api/douban`
- **请求方法**: `GET`
- **功能说明**: 获取豆瓣电影/电视剧数据
- **请求参数**:
  - `type`: 类型，必须是 `tv` 或 `movie`（必填）
  - `tag`: 标签，如 `热门`、`最新` 等（必填）
  - `pageSize`: 每页数量，1-100 之间（可选，默认 16）
  - `pageStart`: 起始位置，不能小于 0（可选，默认 0）
- **返回格式**:
  ```json
  {
    "code": 200,
    "message": "获取成功",
    "list": [
      {
        "id": "string",
        "title": "string",
        "poster": "string",
        "rate": "string"
      }
    ]
  }
  ```
- **错误码**:
  - `400`: 参数错误
  - `500`: 获取豆瓣数据失败

### 用户数据接口

#### 收藏管理

- **接口地址**: `/api/favorites`
- **请求方法**: `GET` / `POST` / `DELETE`
- **功能说明**: 管理用户收藏
- **认证**: 需要认证

##### GET 请求 - 获取收藏

- **请求参数**:
  - `key`: 收藏项 key（可选，格式为 `source+id`）
- **返回格式**:

  ```json
  // 不带key参数时返回所有收藏
  {
    "source+id": {
      "title": "string",
      "poster": "string",
      "source_name": "string",
      "save_time": 1234567890
    }
  }

  // 带key参数时返回单个收藏或null
  {
    "title": "string",
    "poster": "string",
    "source_name": "string",
    "save_time": 1234567890
  }
  ```

##### POST 请求 - 添加收藏

- **请求参数**:
  ```json
  {
    "key": "string", // 必填，格式为 source+id
    "favorite": {
      "title": "string",
      "poster": "string",
      "source_name": "string",
      "save_time": 1234567890
    }
  }
  ```
- **返回格式**:
  ```json
  {
    "success": true
  }
  ```

##### DELETE 请求 - 删除收藏

- **请求参数**:
  - `key`: 收藏项 key（可选，不传则清空所有收藏）
- **返回格式**:

  ```json
  {
    "success": true
  }
  ```

- **错误码**:
  - `400`: 参数错误
  - `401`: 未认证
  - `500`: 服务器内部错误

#### 播放记录管理

- **接口地址**: `/api/playrecords`
- **请求方法**: `GET` / `POST` / `DELETE`
- **功能说明**: 管理用户播放记录
- **认证**: 需要认证

##### GET 请求 - 获取播放记录

- **请求参数**: 无
- **返回格式**:
  ```json
  {
    "source+id": {
      "title": "string",
      "poster": "string",
      "source_name": "string",
      "index": 1,
      "time": 1234567890
    }
  }
  ```

##### POST 请求 - 保存播放记录

- **请求参数**:
  ```json
  {
    "key": "string", // 必填，格式为 source+id
    "record": {
      "title": "string",
      "poster": "string",
      "source_name": "string",
      "index": 1,
      "time": 1234567890
    }
  }
  ```
- **返回格式**:
  ```json
  {
    "success": true
  }
  ```

##### DELETE 请求 - 删除播放记录

- **请求参数**:
  - `key`: 播放记录 key（可选，不传则清空所有记录）
- **返回格式**:

  ```json
  {
    "success": true
  }
  ```

- **错误码**:
  - `400`: 参数错误
  - `401`: 未认证
  - `500`: 服务器内部错误

#### 搜索历史管理

- **接口地址**: `/api/searchhistory`
- **请求方法**: `GET` / `POST` / `DELETE`
- **功能说明**: 管理用户搜索历史
- **认证**: 需要认证

##### GET 请求 - 获取搜索历史

- **请求参数**: 无
- **返回格式**:
  ```json
  ["搜索关键词1", "搜索关键词2"]
  ```

##### POST 请求 - 添加搜索历史

- **请求参数**:
  ```json
  {
    "keyword": "string" // 必填，搜索关键词
  }
  ```
- **返回格式**:
  ```json
  ["搜索关键词1", "搜索关键词2"]
  ```

##### DELETE 请求 - 删除搜索历史

- **请求参数**:
  - `keyword`: 要删除的关键词（可选，不传则清空所有历史）
- **返回格式**:

  ```json
  {
    "success": true
  }
  ```

- **错误码**:
  - `400`: 参数错误
  - `401`: 未认证
  - `500`: 服务器内部错误
