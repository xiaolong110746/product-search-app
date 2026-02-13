// Service Worker - 商品查询系统
const CACHE_NAME = 'product-query-v1';

// 需要缓存的文件列表
const CACHE_FILES = [
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png'
];

// CDN 文件列表（单独缓存）
const CDN_FILES = [
    'https://cdn.jsdelivr.net/npm/ag-grid-community@31.0.3/styles/ag-grid.min.css',
    'https://cdn.jsdelivr.net/npm/ag-grid-community@31.0.3/styles/ag-theme-alpine.min.css',
    'https://cdn.jsdelivr.net/npm/ag-grid-community@31.0.3/dist/ag-grid-community.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://cdn.jsdelivr.net/npm/pinyin-pro@3.18.2/dist/index.js'
];

// 安装事件 - 缓存文件
self.addEventListener('install', event => {
    console.log('[SW] 安装中...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[SW] 缓存本地文件中...');
                // 先缓存本地文件
                const localPromise = cache.addAll(CACHE_FILES);
                
                // 单独缓存 CDN 文件（忽略失败）
                const cdnPromise = Promise.all(
                    CDN_FILES.map(url => {
                        return fetch(url)
                            .then(response => {
                                if (response.ok) {
                                    return cache.put(url, response);
                                }
                            })
                            .catch(err => {
                                console.warn('[SW] CDN缓存失败:', url, err);
                            });
                    })
                );
                
                return Promise.all([localPromise, cdnPromise]);
            })
            .then(() => {
                console.log('[SW] 安装完成');
                return self.skipWaiting();
            })
            .catch(err => {
                console.error('[SW] 安装失败:', err);
            })
    );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', event => {
    console.log('[SW] 激活中...');
    event.waitUntil(
        caches.keys()
            .then(cacheNames => {
                return Promise.all(
                    cacheNames
                        .filter(name => name !== CACHE_NAME)
                        .map(name => {
                            console.log('[SW] 删除旧缓存:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] 激活完成');
                return self.clients.claim();
            })
    );
});

// 请求拦截 - 缓存优先策略
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // 如果有缓存，返回缓存
                if (cachedResponse) {
                    console.log('[SW] 从缓存返回:', event.request.url);
                    return cachedResponse;
                }
                
                // 没有缓存，从网络获取
                console.log('[SW] 从网络获取:', event.request.url);
                return fetch(event.request)
                    .then(response => {
                        // 检查响应是否有效
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        // 克隆响应并缓存
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then(cache => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    })
                    .catch(err => {
                        console.error('[SW] 获取失败:', err);
                        // 离线时可以返回一个默认页面
                        return new Response('离线状态，请检查网络连接');
                    });
            })
    );
});
