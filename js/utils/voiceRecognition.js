export function isVoiceRecognitionSupported() {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function createVoiceRecognition({ onResult, onStart, onEnd, onError } = {}) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    return {
      supported: false,
      start() {
        if (onError) onError(new Error('이 브라우저는 음성메모를 지원하지 않습니다.'));
      },
      stop() {}
    };
  }

  const recognition = new Recognition();
  recognition.lang = 'ko-KR';
  recognition.interimResults = true;
  recognition.continuous = true;

  recognition.onstart = () => onStart?.();
  recognition.onend = () => onEnd?.();
  recognition.onerror = (event) => onError?.(new Error(event.error || '음성 인식 중 오류가 발생했습니다.'));
  recognition.onresult = (event) => {
    let finalText = '';
    let interimText = '';
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const text = event.results[index][0]?.transcript || '';
      if (event.results[index].isFinal) finalText += text;
      else interimText += text;
    }
    onResult?.({ finalText, interimText });
  };

  return {
    supported: true,
    start() { recognition.start(); },
    stop() { recognition.stop(); }
  };
}
