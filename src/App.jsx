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
  const canPlaySound = useRef()
  const [touched, setTouched] = useState(false)

  const init = async () => {
    console.log("init...")
    await setupCamera()
    console.log("camera setup done")

    classifier.current = knnClassifier.create()
    mobilenet.current = await mobilenetModule.load()

    console.log("setup done")
    console.log("Không dơ tay lên trên mặt để train 1")

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
    console.log(`[Training] ${label}`)
    for (let i = 0; i < TRAINING_TIMES; ++i) {
      console.log(`[Progress: ${parseInt(((i + 1) / TRAINING_TIMES) * 100)}%]`)

      await training(label)
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
      console.log("Touched")
      if (canPlaySound.current) {
        canPlaySound.current = false
        sound.play()
      }
      notify("Bé đang chạm tay vào mặt", { body: "Bé đang chạm tay vào mặt" })
      setTouched(true)
    } else {
      console.log("Not touched")
      setTouched(false)
    }

    await sleep(200)

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
      <video ref={video} className="video" autoPlay></video>
      <div className="control">
        <button className="btn" onClick={() => train(NOT_TOUCH_LABEL)}>
          Train 1
        </button>
        <button className="btn" onClick={() => train(TOUCHED_LABEL)}>
          Train 2
        </button>
        <button className="btn" onClick={() => run()}>
          Run
        </button>
      </div>
    </div>
  )
}

export default App
