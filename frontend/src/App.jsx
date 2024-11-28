import { useState, useEffect, useRef } from 'react'
import { ChakraProvider, Box, VStack, Button, Text, Progress, Container, Heading } from '@chakra-ui/react'
import axios from 'axios'

function App() {
  const [isRecording, setIsRecording] = useState(false)
  const [currentPhrase, setCurrentPhrase] = useState(null)
  const [stats, setStats] = useState(null)
  const [openAIWs, setOpenAIWs] = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])

  useEffect(() => {
    // Connect to OpenAI WebSocket
    const ws = new WebSocket('wss://api.openai.com/v1/realtime', {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        'OpenAI-Beta': 'realtime=v1'
      }
    })
    
    ws.onopen = () => {
      console.log('Connected to OpenAI')
      setOpenAIWs(ws)
    }

    ws.onmessage = handleOpenAIMessage

    return () => ws.close()
  }, [])

  useEffect(() => {
    // Load initial phrase and stats
    loadDuePhrase()
    loadStats()
  }, [])

  const handleOpenAIMessage = (event) => {
    const data = JSON.parse(event.data)
    if (data.type === 'text') {
      // Handle transcription/feedback
      console.log('OpenAI response:', data.content)
    } else if (data.type === 'audio') {
      // Play audio response
      const audio = new Audio(`data:audio/wav;base64,${data.audio}`)
      audio.play()
    }
  }

  const loadDuePhrase = async () => {
    try {
      const response = await axios.get('http://localhost:8000/phrases/due')
      if (response.data.length > 0) {
        setCurrentPhrase(response.data[0])
      }
    } catch (error) {
      console.error('Error loading phrase:', error)
    }
  }

  const loadStats = async () => {
    try {
      const response = await axios.get('http://localhost:8000/phrases/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      
      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data)
      }
      
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current)
        const reader = new FileReader()
        reader.readAsDataURL(audioBlob)
        reader.onloadend = () => {
          const base64Audio = reader.result.split(',')[1]
          if (openAIWs) {
            openAIWs.send(JSON.stringify({
              type: 'audio',
              audio: base64Audio
            }))
          }
        }
        audioChunksRef.current = []
      }
      
      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error starting recording:', error)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  return (
    <ChakraProvider>
      <Container maxW="container.md" py={8}>
        <VStack spacing={6}>
          <Heading>AI Hindi Tutor</Heading>
          
          {stats && (
            <Box w="100%" p={4} borderWidth={1} borderRadius="lg">
              <Text>Mastered: {stats.mastered_phrases} / {stats.total_phrases}</Text>
              <Progress value={(stats.average_mastery * 100)} mt={2} />
            </Box>
          )}
          
          {currentPhrase && (
            <Box w="100%" p={6} borderWidth={1} borderRadius="lg">
              <Text fontSize="2xl" mb={2}>{currentPhrase.hindi}</Text>
              <Text color="gray.600">{currentPhrase.english}</Text>
              <Text fontSize="sm" color="gray.500" mt={2}>Context: {currentPhrase.context}</Text>
            </Box>
          )}
          
          <Button
            size="lg"
            colorScheme="blue"
            w="100%"
            h="100px"
            onMouseDown={startRecording}
            onMouseUp={stopRecording}
            onMouseLeave={stopRecording}
          >
            {isRecording ? 'Recording...' : 'Hold to Speak'}
          </Button>
        </VStack>
      </Container>
    </ChakraProvider>
  )
}

export default App
