import React, { useEffect, useRef, useState } from "react"
import * as mobilenetModule from "@tensorflow-models/mobilenet"
import * as knnClassifier from "@tensorflow-models/knn-classifier"
import "@tensorflow/tfjs-backend-webgl"
import { Howl } from "howler"
import soundURL from "./assets/eh.mp3"
import { initNotifications, notify } from "@mycv/f8-notification"
import "./App.css"

let sound = new Howl({
  src: [soundURL],
})

const NOT_TOUCH_LABEL = "not_touch"
const TOUCHED_LABEL = "touched"
const TRAINING_TIMES = 50
const TOUCHED_CONFIDENCE = 0.8

function App() {
  const video = useRef()
  const classifier = useRef()
  const mobilenet = useRef()
  const canPlaySound = useRef(true)
  const [touched, setTouched] = useState(false)

  const [step, setStep] = useState(0)
  const [notification, setNotification] = useState("")
  const [showTrain1Button, setShowTrain1Button] = useState(true)
  const [showTrain2Button, setShowTrain2Button] = useState(false)
  const [showRunButton, setShowRunButton] = useState(false)

  const init = async () => {
    setStep(0)
    setNotification("Quá trình đang khởi tạo, vui lòng chờ trong giây lát...")
    console.log("init...")
    await setupCamera()
    console.log("camera setup done")

    classifier.current = knnClassifier.create()
    mobilenet.current = await mobilenetModule.load()
    console.log("setup done")

    setStep(1)
    setNotification("Bước 1: Không dơ tay lên trên mặt giúp AI học")

    initNotifications({ cooldown: 3000 })
  }

  const setupCamera = () => {
    return new Promise((resolve, reject) => {
      navigator.getUserMedia =
        navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia

      if (navigator.getUserMedia) {
        navigator.getUserMedia(
          { video: true },
          (stream) => {
            video.current.srcObject = stream

            // Đảo chiều camera
            video.current.style.transform = "scaleX(-1)"

            video.current.addEventListener("loadeddata", resolve)
          },
          (error) => {
            reject(error)
          }
        )
      } else {
        reject()
      }
    })
  }

  const train = async (label) => {
    setNotification(`[Training] ${label}`)
    for (let i = 0; i < TRAINING_TIMES; ++i) {
      setNotification(
        `[Progress: ${parseInt(((i + 1) / TRAINING_TIMES) * 100)}%]`
      )
      await training(label)
    }

    if (label === NOT_TOUCH_LABEL) {
      setStep(2)
      setShowTrain1Button(false)
      setShowTrain2Button(true)
      setNotification(
        "Bước 2: Chạm tay vào mặt rồi nhấn nút, trong quá trình hãy di chuyển tay khap mặt để AI học"
      )
    } else if (label === TOUCHED_LABEL) {
      setStep(3)
      setShowTrain2Button(false)
      setShowRunButton(true)
      setNotification(
        "Đã hoàn thành quá trình học. Nhấn nút 'Run' để chạy AI (* Có âm thanh khi cảnh báo, tắt tiếng trước khi quá muộn)"
      )
    }
  }

  /**
   * Bước 1: Train cho máy khuôn mặt không chạm tay
   * Bước 2: Train cho máy khuôn mặt chạm tay
   * Bước 3: Lấy hình ảnh hiện tại, phân tích và so sánh với data đã học
   * ===> Nếu mà matching với data khuôn mặt không chạm tay thì báo không chạm tay ===> Cảnh báo
   * @param {*} label
   * @returns
   */

  const training = (label) => {
    return new Promise(async (resolve) => {
      const embedding = mobilenet.current.infer(video.current, true)
      classifier.current.addExample(embedding, label)
      await sleep(100)
      resolve()
    })
  }

  const run = async () => {
    const embedding = mobilenet.current.infer(video.current, true)
    const result = await classifier.current.predictClass(embedding)

    // console.log("Label: ", result.label)
    // console.log("Label: ", result.confidences)

    if (
      result.label === TOUCHED_LABEL &&
      result.confidences[result.label] > TOUCHED_CONFIDENCE
    ) {
      setNotification("Chạm rùi")
      if (canPlaySound.current) {
        canPlaySound.current = false
        sound.play()
      }
      notify("Bé đang chạm tay vào mặt", { body: "Bé đang chạm tay vào mặt" })
      setTouched(true)
    } else {
      setNotification("Không chạm tay")
      setTouched(false)
    }

    await sleep(200)

    setStep(4)
    setShowTrain2Button(false)
    setShowRunButton(false)
    run()
  }

  const sleep = (ms = 0) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  useEffect(() => {
    init()
    // Cleanup (optional)
    sound.on("end", function () {
      canPlaySound.current = true
    })
    return () => {
      // Perform any cleanup here if needed
    }
  }, [])

  return (
    <div className={`main ${touched ? "touched" : ""}`}>
      <h1 className="title">Welcome to Luan 1st game</h1>
      <video ref={video} className="video" autoPlay></video>
      <div className="control">
        {showTrain1Button && step === 1 && (
          <button className="btn" onClick={() => train(NOT_TOUCH_LABEL)}>
            Bắt Đầu
          </button>
        )}
        {showTrain2Button && step === 2 && (
          <button className="btn" onClick={() => train(TOUCHED_LABEL)}>
            Tiếp tục
          </button>
        )}
        {showRunButton && step === 3 && (
          <button className="btn" onClick={() => run()}>
            Chayyyyyyỵ
          </button>
        )}
      </div>
      <div className="notification">{notification}</div>
    </div>
  )
}

export default App
