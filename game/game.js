// 游戏状态
const gameState = {
  score: 0,
  time: 30,
  isPlaying: false,
  timer: null,
  fruitInterval: null,
  difficultyTimer: null,
  fruits: [],
  canvas: null,
  ctx: null,
  canvasWidth: 0,
  canvasHeight: 500,
  soundEnabled: true,
  bestScore: 0,
  fruitsClicked: 0,
  fruitsMissed: 0,
  fruitImages: {},
  lastFrameTime: 0,
  devicePixelRatio: window.devicePixelRatio || 1,
  maxFruits: 8, // 限制屏幕上的最大水果数量
  touchStartY: 0,
  scrollLocked: false,
  isPortrait: window.innerHeight > window.innerWidth
};

// 预加载水果表情符号到图像
function preloadFruitEmojis() {
  const fruitTypes = ['🍎', '🍊', '🍌', '🍇', '🍓', '🍉'];
  const tempCanvas = document.createElement('canvas');
  const tempCtx = tempCanvas.getContext('2d');
  tempCanvas.width = 50;
  tempCanvas.height = 50;

  fruitTypes.forEach(fruit => {
    tempCtx.clearRect(0, 0, 50, 50);
    tempCtx.font = '40px Arial';
    tempCtx.textBaseline = 'middle';
    tempCtx.textAlign = 'center';
    tempCtx.fillText(fruit, 25, 25);

    const img = new Image();
    img.src = tempCanvas.toDataURL('image/png');
    gameState.fruitImages[fruit] = img;
  });
}

// 初始化画布
function initCanvas() {
  gameState.canvas = document.getElementById('gameCanvas');
  if (!gameState.canvas) {
    console.error('无法找到游戏画布元素');
    return;
  }

  gameState.ctx = gameState.canvas.getContext('2d', { alpha: false });

  // 响应式设置
  function resizeCanvas() {
    const containerWidth = gameState.canvas.parentElement?.clientWidth || 0;
    gameState.isPortrait = window.innerHeight > window.innerWidth;
    gameState.canvasWidth = containerWidth;
    gameState.canvasHeight = gameState.isPortrait ? 500 : 450;

    const dpr = window.devicePixelRatio || 1;
    gameState.canvas.width = gameState.canvasWidth * dpr;
    gameState.canvas.height = gameState.canvasHeight * dpr;

    gameState.canvas.style.width = `${gameState.canvasWidth}px`;
    gameState.canvas.style.height = `${gameState.canvasHeight}px`;

    gameState.ctx.scale(dpr, dpr);
    gameState.ctx.font = '32px Arial';
    gameState.ctx.textBaseline = 'middle';
  }

  function debounce(func, delay = 100) {
    let timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, arguments), delay);
    };
  }

  resizeCanvas();
  window.removeEventListener('resize', resizeCanvas);
  window.addEventListener('resize', debounce(resizeCanvas));

  const savedScore = localStorage.getItem('fruitGameBestScore');
  gameState.bestScore = Math.max(0, parseInt(savedScore) || 0);
  document.getElementById('bestScore').textContent = gameState.bestScore;
  document.getElementById('bestScoreDisplay').textContent = gameState.bestScore;

  preloadFruitEmojis();
}

// 水果类
class Fruit {
  constructor() {
    this.x = Math.random() * (gameState.canvasWidth - 40) + 20; // 确保不会出现在边缘
    this.y = -30;
    this.speed = 2 + Math.random() * 3;
    this.size = 40;
    this.types = ['🍎', '🍊', '🍌', '🍇', '🍓', '🍉'];
    this.type = this.types[Math.floor(Math.random() * this.types.length)];
    this.hit = false;
    this.hitTime = 0;
    this.fallSpeedMultiplier = 1;
    this.rotation = 0;
    this.rotationSpeed = Math.random() * 0.02 - 0.01;
    this.scaleEffect = 1;
    this.scaleDirection = 0.002;
  }

  update(deltaTime) {
    // 使用增量时间使移动速度与帧率无关
    const frameAdjustedSpeed = this.speed * this.fallSpeedMultiplier * (deltaTime / (1000/60));
    this.y += frameAdjustedSpeed;

    // 旋转效果
    this.rotation += this.rotationSpeed * deltaTime / 16;

    // 缩放效果
    this.scaleEffect += this.scaleDirection;
    if (this.scaleEffect > 1.05) this.scaleDirection = -0.002;
    else if (this.scaleEffect < 0.95) this.scaleDirection = 0.002;

    // 处理点击效果
    if (this.hit && Date.now() - this.hitTime > 300) {
      return false; // 返回false表示该水果应被移除
    }

    return true; // 水果仍然活跃
  }

  draw() {
    gameState.ctx.save();

    // 绘制阴影
    if (!this.hit) {
      gameState.ctx.shadowColor = 'rgba(0,0,0,0.2)';
      gameState.ctx.shadowBlur = 4;
      gameState.ctx.shadowOffsetY = 2;
    }

    // 设置变换
    gameState.ctx.translate(this.x + this.size/2, this.y);
    gameState.ctx.rotate(this.rotation);
    gameState.ctx.scale(this.scaleEffect, this.scaleEffect);

    if (this.hit) {
      // 命中动画
      const progress = (Date.now() - this.hitTime) / 300;
      gameState.ctx.globalAlpha = 1 - progress;
      gameState.ctx.scale(1 + progress * 0.5, 1 + progress * 0.5);
    }

    // 使用预渲染的水果图像
    if (gameState.fruitImages[this.type]) {
      gameState.ctx.drawImage(
        gameState.fruitImages[this.type],
        -this.size/2,
        -this.size/2,
        this.size,
        this.size
      );
    } else {
      // 后备方案
      gameState.ctx.fillText(this.type, -this.size/4, 0);
    }

    gameState.ctx.restore();
  }

  checkClick(x, y) {
    // 改进的点击检测，使用圆形区域
    const dx = this.x + this.size/2 - x;
    const dy = this.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance <= this.size/2;
  }
}

// 开始游戏
function startGame() {
  if (gameState.isPlaying) return;

  gameState.isPlaying = true;
  gameState.score = 0;
  gameState.time = 30;
  gameState.fruits = [];
  gameState.fruitsClicked = 0;
  gameState.fruitsMissed = 0;
  gameState.lastFrameTime = performance.now();

  updateScore();
  updateTime();
  updateDifficultyBar();

  // 清空画布
  gameState.ctx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);

  // 创建水果生成定时器
  gameState.fruitInterval = setInterval(createFruit, 800);

  // 创建难度递增定时器
  gameState.difficultyTimer = setInterval(() => {
    if (gameState.isPlaying && gameState.time > 0) {
      // 增加水果生成速度
      clearInterval(gameState.fruitInterval);
      const interval = Math.max(300, 800 - (30 - gameState.time) * 16);
      gameState.fruitInterval = setInterval(createFruit, interval);

      // 增加水果下落速度
      const speedMultiplier = 1 + (30 - gameState.time) * 0.04;
      gameState.fruits.forEach(fruit => {
        fruit.fallSpeedMultiplier = speedMultiplier;
      });

      // 更新难度条
      updateDifficultyBar();

      // 增加最大水果数
      if (gameState.time < 15) {
        gameState.maxFruits = 10;
      }
      if (gameState.time < 8) {
        gameState.maxFruits = 12;
      }
    }
  }, 5000);

  // 使用requestAnimationFrame实现游戏循环
  function gameLoop(timestamp) {
    if (!gameState.isPlaying) return;

    // 计算帧间隔时间
    const deltaTime = timestamp - gameState.lastFrameTime;
    gameState.lastFrameTime = timestamp;

    // 清空画布
    gameState.ctx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);

    // 更新和绘制水果
    for (let i = gameState.fruits.length - 1; i >= 0; i--) {
      const fruit = gameState.fruits[i];
      const isActive = fruit.update(deltaTime);

      if (!isActive) {
        // 水果需要被移除
        gameState.fruits.splice(i, 1);
        continue;
      }

      fruit.draw();

      if (!fruit.hit && fruit.y > gameState.canvasHeight + 20) {
        gameState.fruits.splice(i, 1);
        gameState.score = Math.max(0, gameState.score - 5); // 防止分数为负
        gameState.fruitsMissed++;
        updateScore();

        // 播放失败音效
        if (gameState.soundEnabled) {
          const failSound = document.getElementById('failSound');
          failSound.currentTime = 0;
          failSound.volume = 0.3;
          failSound.play().catch(e => console.log('音频播放失败:', e));
        }
      }
    }

    // 继续游戏循环
    if (gameState.isPlaying) {
      requestAnimationFrame(gameLoop);
    }
  }

  // 开始游戏循环
  requestAnimationFrame(gameLoop);

  // 倒计时
  gameState.timer = setInterval(() => {
    gameState.time--;
    updateTime();

    if (gameState.time <= 0) {
      endGame();
    }
  }, 1000);
}

// 创建水果
function createFruit() {
  if (!gameState.isPlaying) return;

  // 限制水果数量
  if (gameState.fruits.length < gameState.maxFruits) {
    const newFruit = new Fruit();

    // 随时间增加难度
    const speedMultiplier = 1 + (30 - gameState.time) * 0.04;
    newFruit.fallSpeedMultiplier = speedMultiplier;

    // 检查是否与现有水果重叠
    const isOverlapping = gameState.fruits.some(
      fruit => Math.abs(fruit.x - newFruit.x) < 50 && Math.abs(fruit.y - newFruit.y) < 50
    );

    if (!isOverlapping) {
      gameState.fruits.push(newFruit);
    }
  }
}

// 处理点击事件
function handleClick(e) {
  if (!gameState.isPlaying) return;

  // 获取点击位置
  const rect = gameState.canvas.getBoundingClientRect();
  const clickX = (e.clientX - rect.left) * (gameState.canvas.width / rect.width / gameState.devicePixelRatio);
  const clickY = (e.clientY - rect.top) * (gameState.canvas.height / rect.height / gameState.devicePixelRatio);

  // 检查是否点击到水果
  for (let i = gameState.fruits.length - 1; i >= 0; i--) {
    const fruit = gameState.fruits[i];
    if (fruit.checkClick(clickX, clickY) && !fruit.hit) {
      // 标记水果被点击
      fruit.hit = true;
      fruit.hitTime = Date.now();

      // 增加分数和点击计数
      gameState.score += 10;
      gameState.fruitsClicked++;
      updateScore();

      // 显示得分动画
      const scoreElement = document.createElement('div');
      scoreElement.classList.add('score-popup');
      scoreElement.textContent = '+10';
      scoreElement.style.left = `${e.clientX - rect.left}px`;
      scoreElement.style.top = `${e.clientY - rect.top}px`;
      gameState.canvas.parentElement.appendChild(scoreElement);

      setTimeout(() => {
        if (scoreElement.parentNode) {
          scoreElement.parentNode.removeChild(scoreElement);
        }
      }, 800);

      // 播放点击音效
      if (gameState.soundEnabled) {
        const clickSound = document.getElementById('clickSound');
        clickSound.currentTime = 0;
        clickSound.volume = 0.3;
        clickSound.play().catch(e => console.log('音频播放失败:', e));
      }

      break;
    }
  }
}

// 更新分数显示
function updateScore() {
  const scoreElement = document.getElementById('score');
  if (!scoreElement) return;

  scoreElement.textContent = gameState.score;

  // 添加分数变化的视觉反馈
  scoreElement.classList.remove('animate-scale');
  void scoreElement.offsetWidth; // 触发重流以重置动画
  scoreElement.classList.add('animate-scale');

  // 更新分数颜色
  const scoreDisplay = document.getElementById('scoreDisplay');
  if (gameState.score < 0) {
    scoreDisplay.classList.add('bg-red-100');
    scoreDisplay.classList.remove('bg-white/80');
  } else {
    scoreDisplay.classList.remove('bg-red-100');
    scoreDisplay.classList.add('bg-white/80');
  }
}

// 更新时间显示
function updateTime() {
  const timeElement = document.getElementById('time');
  if (!timeElement) return;

  timeElement.textContent = gameState.time;

  const timeDisplay = document.getElementById('timeDisplay');
  if (gameState.time <= 10) {
    timeDisplay.classList.add('bg-red-500', 'text-white');
    timeDisplay.classList.remove('bg-white/80');

    // 时间不多时添加脉动效果
    if (gameState.time <= 5) {
      timeDisplay.classList.add('animate-pulse');
    }
  } else {
    timeDisplay.classList.remove('bg-red-500', 'text-white', 'animate-pulse');
    timeDisplay.classList.add('bg-white/80');
  }
}

// 更新难度条
function updateDifficultyBar() {
  const difficultyPercent = 100 - (gameState.time / 30 * 100);
  const difficultyBar = document.getElementById('difficultyBar');
  const difficultyText = document.getElementById('difficultyText');

  difficultyBar.style.width = `${difficultyPercent}%`;

  // 更新难度文本
  if (difficultyPercent < 30) {
    difficultyText.textContent = '简单';
    difficultyText.className = 'text-sm text-green-500';
  } else if (difficultyPercent < 60) {
    difficultyText.textContent = '中等';
    difficultyText.className = 'text-sm text-yellow-500';
  } else {
    difficultyText.textContent = '困难';
    difficultyText.className = 'text-sm text-red-500';
  }
}

// 结束游戏
function endGame() {
  gameState.isPlaying = false;
  clearInterval(gameState.fruitInterval);
  clearInterval(gameState.timer);
  clearInterval(gameState.difficultyTimer);

  // 清理水果数组，释放内存
  gameState.fruits = [];

  // 更新最高分
  if (gameState.score > gameState.bestScore) {
    gameState.bestScore = gameState.score;
    localStorage.setItem('fruitGameBestScore', gameState.bestScore);
    document.getElementById('bestScore').textContent = gameState.bestScore;
  }

  // 更新游戏结束弹窗数据
  document.getElementById('finalScore').textContent = gameState.score;
  document.getElementById('fruitsClicked').textContent = gameState.fruitsClicked;
  document.getElementById('fruitsMissed').textContent = gameState.fruitsMissed;
  document.getElementById('bestScoreDisplay').textContent = gameState.bestScore;

  // 显示游戏结束弹窗
  const modal = document.getElementById('gameOverModal');
  const modalContent = document.getElementById('modalContent');

  modal.classList.remove('hidden');
  setTimeout(() => {
    modalContent.classList.remove('scale-95', 'opacity-0');
    modalContent.classList.add('scale-100', 'opacity-100');
  }, 10);

  // 播放游戏结束音效
  if (gameState.soundEnabled) {
    const gameOverSound = document.getElementById('gameOverSound');
    gameOverSound.volume = 0.5;
    gameOverSound.play().catch(e => console.log('音频播放失败:', e));
  }
}

// 重置游戏
function resetGame() {
  gameState.isPlaying = false;
  clearInterval(gameState.fruitInterval);
  clearInterval(gameState.timer);
  clearInterval(gameState.difficultyTimer);

  // 清理内存
  gameState.fruits = [];
  gameState.score = 0;
  gameState.time = 30;
  gameState.maxFruits = 8;

  updateScore();
  updateTime();
  updateDifficultyBar();

  // 清空画布
  gameState.ctx.clearRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);

  // 显示游戏引导层
  document.getElementById('gameIntro').classList.remove('hidden');

  // 隐藏游戏结束弹窗
  const modal = document.getElementById('gameOverModal');
  const modalContent = document.getElementById('modalContent');

  modalContent.classList.add('scale-95', 'opacity-0');
  modalContent.classList.remove('scale-100', 'opacity-100');

  setTimeout(() => {
    modal.classList.add('hidden');
  }, 300);
}

// 切换音效
function toggleSound() {
  gameState.soundEnabled = !gameState.soundEnabled;
  const soundIcon = document.getElementById('soundIcon');

  if (gameState.soundEnabled) {
    soundIcon.classList.remove('fa-volume-off');
    soundIcon.classList.add('fa-volume-up');
  } else {
    soundIcon.classList.remove('fa-volume-up');
    soundIcon.classList.add('fa-volume-off');
  }
}

// 阻止页面滑动
function preventPageScroll(e) {
  // 仅当游戏正在进行时阻止滑动
  if (gameState.isPlaying) {
    e.preventDefault();
  }
}

// 事件监听
function setupEventListeners() {
  document.getElementById('startGameBtn').addEventListener('click', () => {
    document.getElementById('gameIntro').classList.add('hidden');
    startGame();
  });

  document.getElementById('resetBtn').addEventListener('click', resetGame);
  document.getElementById('playAgainBtn').addEventListener('click', resetGame);
  document.getElementById('soundBtn').addEventListener('click', toggleSound);

  // 鼠标点击事件
  gameState.canvas.addEventListener('click', handleClick);

  // 触摸事件优化
  gameState.canvas.addEventListener('touchstart', (e) => {
    if (gameState.isPlaying) {
      e.preventDefault(); // 防止默认行为
    }

    gameState.touchStartY = e.touches[0].clientY;

    const touch = e.touches[0];
    const rect = gameState.canvas.getBoundingClientRect();

    // 调用相同的处理程序
    const clickEvent = new MouseEvent('click', {
      clientX: touch.clientX,
      clientY: touch.clientY
    });
    gameState.canvas.dispatchEvent(clickEvent);
  }, {passive: false});

  // 阻止触摸滑动造成页面滚动
  gameState.canvas.addEventListener('touchmove', (e) => {
    if (gameState.isPlaying) {
      e.preventDefault();

      // 检测垂直滑动
      const touchY = e.touches[0].clientY;
      const deltaY = touchY - gameState.touchStartY;

      // 如果是大幅度下滑，可以创建一个新的水果
      if (deltaY > 50 && !gameState.scrollLocked) {
        createFruit();
        gameState.scrollLocked = true;
        setTimeout(() => {
          gameState.scrollLocked = false;
        }, 500);
      }
    }
  }, {passive: false});

  // 屏幕旋转处理
  window.addEventListener('orientationchange', () => {
    // 给一个短暂延迟让浏览器完成旋转
    setTimeout(() => {
      initCanvas();
    }, 300);
  })
}

// 初始化事件监听
window.addEventListener('DOMContentLoaded', () => {
  initCanvas();
  setupEventListeners();
});
